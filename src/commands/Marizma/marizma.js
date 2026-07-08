import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  SlashCommandBuilder,
} from 'discord.js';
import { getMarizmaConfig } from '../../utils/database.js';
import {
  getServerInfo,
  getServerPlayers,
  getServerQueue,
  getServerBans,
  announceMessage,
  shutdownServer,
  updateServerSetting,
  toggleBan,
  kickPlayer,
  setBanner,
} from '../../utils/marizmaApi.js';

function fillTemplate(template, host, cohost) {
  return template
    .replace(/\{host\}/g, host)
    .replace(/\{cohost\}/g, cohost || 'None');
}

function buildSsuEmbed(title, description, color, guild) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  const logoUrl = guild?.iconURL({ dynamic: true, size: 256 });
  if (logoUrl) {
    embed.setThumbnail(logoUrl);
    embed.setFooter({ text: 'Marizma SSU System', iconURL: logoUrl });
  } else {
    embed.setThumbnail('https://i.imgur.com/YourServerLogo.png');
    embed.setFooter({ text: 'Marizma SSU System' });
  }
  return embed;
}

async function purgeChannel(channel) {
  let fetched;
  do {
    fetched = await channel.messages.fetch({ limit: 100 });
    if (fetched.size > 0) {
      await channel.bulkDelete(fetched, true);
    }
  } while (fetched.size === 100);
}

function requireConfig(cfg) {
  if (!cfg || !cfg.apiKey || !cfg.baseUrl) {
    return '❌ Please run `/marizma setup` first.';
  }
  return null;
}

function errorEmbed(title, description) {
  return new EmbedBuilder().setColor(Colors.Red).setTitle(title).setDescription(description).setTimestamp();
}

function successEmbed(title, description) {
  return new EmbedBuilder().setColor(Colors.Green).setTitle(title).setDescription(description).setTimestamp();
}

export default {
  data: new SlashCommandBuilder()
    .setName('marizma')
    .setDescription('Marizma Roblox server integration')
    .addSubcommand(sub =>
      sub.setName('setup').setDescription('Configure Marizma integration settings'))
    .addSubcommand(sub =>
      sub
        .setName('startup')
        .setDescription('Start an SSU session')
        .addUserOption(o => o.setName('host').setDescription('Session host').setRequired(true))
        .addUserOption(o => o.setName('cohost').setDescription('Session co-host').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('shutdown').setDescription('Shutdown the Roblox server'))
    .addSubcommand(sub =>
      sub.setName('serverinfo').setDescription('Get public server information'))
    .addSubcommand(sub =>
      sub.setName('players').setDescription('Get current players in the server'))
    .addSubcommand(sub =>
      sub.setName('queue').setDescription('Get the server join queue'))
    .addSubcommand(sub =>
      sub.setName('bans').setDescription('Get all banned user IDs'))
    .addSubcommand(sub =>
      sub
        .setName('announce')
        .setDescription('Announce a message to the server')
        .addStringOption(o => o.setName('message').setDescription('Message to announce').setRequired(true)))
    .addSubcommand(sub =>
      sub
        .setName('settings')
        .setDescription('Update server settings')
        .addBooleanOption(o => o.setName('private').setDescription('Set server to private').setRequired(false))
        .addBooleanOption(o => o.setName('hidefromlist').setDescription('Hide server from listing').setRequired(false))
        .addIntegerOption(o => o.setName('minlevel').setDescription('Minimum level to join').setRequired(false)))
    .addSubcommand(sub =>
      sub
        .setName('toggleban')
        .setDescription('Ban or unban a user')
        .addIntegerOption(o => o.setName('userid').setDescription('Roblox user ID').setRequired(true))
        .addBooleanOption(o => o.setName('banned').setDescription('True = ban, False = unban').setRequired(true)))
    .addSubcommand(sub =>
      sub
        .setName('kick')
        .setDescription('Kick a player from the server')
        .addIntegerOption(o => o.setName('userid').setDescription('Roblox user ID').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Moderation reason').setRequired(false)))
    .addSubcommand(sub =>
      sub
        .setName('setbanner')
        .setDescription('Set the server banner image')
        .addStringOption(o => o.setName('url').setDescription('Banner image URL').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'setup') return handleSetup(interaction);

    const cfg = await getMarizmaConfig(interaction.guildId);
    const missing = requireConfig(cfg);
    if (missing) {
      await interaction.reply({ content: missing, ephemeral: true });
      return;
    }

    const handlers = {
      startup: handleStartup,
      shutdown: handleShutdown,
      serverinfo: handleServerInfo,
      players: handlePlayers,
      queue: handleQueue,
      bans: handleBans,
      announce: handleAnnounce,
      settings: handleSettings,
      toggleban: handleToggleBan,
      kick: handleKick,
      setbanner: handleSetBanner,
    };

    const handler = handlers[sub];
    if (handler) {
      await handler(interaction, cfg);
    }
  },
};

async function handleSetup(interaction) {
  try {
    const cfg = await getMarizmaConfig(interaction.guildId);

    const apiKeyInput = new TextInputBuilder()
      .setCustomId('apiKey')
      .setLabel('API Key')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const baseUrlInput = new TextInputBuilder()
      .setCustomId('baseUrl')
      .setLabel('Base URL')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://maple-api.marizma.games')
      .setRequired(true);

    if (cfg) {
      if (cfg.apiKey) apiKeyInput.setValue(cfg.apiKey);
      if (cfg.baseUrl) baseUrlInput.setValue(cfg.baseUrl);
    }

    const modal = new ModalBuilder()
      .setCustomId('marizma_setup_modal')
      .setTitle('Marizma Setup — Step 1');

    modal.addComponents(
      new ActionRowBuilder().addComponents(apiKeyInput),
      new ActionRowBuilder().addComponents(baseUrlInput),
    );

    await interaction.showModal(modal);
  } catch (err) {
    await interaction.reply({ content: `❌ Failed to open setup form: ${err.message}`, ephemeral: true });
  }
}

async function handleStartup(interaction, cfg) {
  const host = interaction.options.getUser('host');
  const cohost = interaction.options.getUser('cohost');
  const channelId = cfg.sessionsChannel;

  if (!channelId) {
    await interaction.reply({ content: '❌ No Sessions Channel configured.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const channel = await interaction.guild.channels.fetch(channelId);
  if (!channel) {
    await interaction.editReply({ content: '❌ Sessions Channel not found.' });
    return;
  }

  await purgeChannel(channel);

  const startupMsg = fillTemplate(cfg.startupTemplate, host.toString(), cohost?.toString() ?? 'None');
  await channel.send(startupMsg);

  const embed = buildSsuEmbed(
    '🚀 SSU Session Started',
    `**Host:** ${host}\n**Co-host:** ${cohost || 'None'}\n\nGet in-game and enjoy!`,
    Colors.Green,
    interaction.guild,
  );
  await channel.send({ embeds: [embed] });

  await interaction.editReply({ content: '✅ SSU startup complete.' });
}

async function handleShutdown(interaction, cfg) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await shutdownServer(cfg.apiKey, cfg.baseUrl);
    console.log('Shutdown API response:', result);
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed('❌ Shutdown Failed', err.message)] });
    return;
  }

  const channelId = cfg.sessionsChannel;
  if (channelId) {
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (channel) {
      await purgeChannel(channel);
      const shutdownMsg = fillTemplate(cfg.shutdownTemplate, 'Server', '');
      const embed = buildSsuEmbed('🛑 Server Shut Down', shutdownMsg, Colors.Red, interaction.guild);
      await channel.send({ embeds: [embed] });
    }
  }

  await interaction.editReply({ content: '✅ Server shutdown complete.' });
}

async function handleServerInfo(interaction, cfg) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const { data } = await getServerInfo(cfg.apiKey, cfg.baseUrl);
    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(data.ServerName || 'Server Info')
      .setDescription(data.ServerDescription || 'No description')
      .setThumbnail(data.Icon || null)
      .addFields(
        { name: 'Players', value: `${data.PlayerCount ?? '?'} / ${data.MaxPlayers ?? '?'}`, inline: true },
        { name: 'Code', value: data.Code || 'N/A', inline: true },
        { name: 'Owner ID', value: `${data.Owner ?? '?'}`, inline: true },
        { name: 'Admins', value: data.Admins?.length ? data.Admins.join(', ') : 'None', inline: false },
        { name: 'Head Admins', value: data.HeadAdmins?.length ? data.HeadAdmins.join(', ') : 'None', inline: false },
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed('❌ Failed to fetch server info', err.message)] });
  }
}

async function handlePlayers(interaction, cfg) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const { data } = await getServerPlayers(cfg.apiKey, cfg.baseUrl);
    const players = data.Players || [];
    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(`👥 Players (${players.length})`)
      .setDescription(players.length ? players.map(id => `\`${id}\``).join(', ') : 'No players online.')
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed('❌ Failed to fetch players', err.message)] });
  }
}

async function handleQueue(interaction, cfg) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const { data } = await getServerQueue(cfg.apiKey, cfg.baseUrl);
    const queue = data.Queue || [];
    const embed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle(`⏳ Queue (${queue.length})`)
      .setDescription(queue.length ? queue.map(id => `\`${id}\``).join(', ') : 'Queue is empty.')
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed('❌ Failed to fetch queue', err.message)] });
  }
}

async function handleBans(interaction, cfg) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const { data } = await getServerBans(cfg.apiKey, cfg.baseUrl);
    const bans = data.Bans || [];
    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle(`🔨 Bans (${bans.length})`)
      .setDescription(bans.length ? bans.map(id => `\`${id}\``).join(', ') : 'No bans.')
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed('❌ Failed to fetch bans', err.message)] });
  }
}

async function handleAnnounce(interaction, cfg) {
  const message = interaction.options.getString('message', true);
  await interaction.deferReply({ ephemeral: true });

  try {
    await announceMessage(cfg.apiKey, cfg.baseUrl, message);
    await interaction.editReply({ embeds: [successEmbed('📢 Announcement Sent', `\`\`\`${message}\`\`\``)] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed('❌ Announcement Failed', err.message)] });
  }
}

async function handleSettings(interaction, cfg) {
  const body = {};
  const priv = interaction.options.getBoolean('private');
  const hide = interaction.options.getBoolean('hidefromlist');
  const minLvl = interaction.options.getInteger('minlevel');

  if (priv !== null) body.Private = priv;
  if (hide !== null) body.HideFromList = hide;
  if (minLvl !== null) body.minLevel = minLvl;

  if (Object.keys(body).length === 0) {
    await interaction.reply({ content: '❌ Provide at least one setting to change.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    await updateServerSetting(cfg.apiKey, cfg.baseUrl, body);
    const fields = Object.entries(body).map(([k, v]) => `${k}: \`${v}\``);
    await interaction.editReply({ embeds: [successEmbed('⚙️ Settings Updated', fields.join('\n'))] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed('❌ Settings Update Failed', err.message)] });
  }
}

async function handleToggleBan(interaction, cfg) {
  const userId = interaction.options.getInteger('userid', true);
  const banned = interaction.options.getBoolean('banned', true);
  await interaction.deferReply({ ephemeral: true });

  try {
    await toggleBan(cfg.apiKey, cfg.baseUrl, userId, banned);
    const action = banned ? 'Banned' : 'Unbanned';
    await interaction.editReply({ embeds: [successEmbed(`🔨 ${action}`, `User ID: \`${userId}\``)] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed('❌ Ban Toggle Failed', err.message)] });
  }
}

async function handleKick(interaction, cfg) {
  const userId = interaction.options.getInteger('userid', true);
  const reason = interaction.options.getString('reason');
  await interaction.deferReply({ ephemeral: true });

  try {
    await kickPlayer(cfg.apiKey, cfg.baseUrl, userId, reason || '');
    const embed = successEmbed('👢 Player Kicked', `User ID: \`${userId}\``);
    if (reason) embed.setDescription(`User ID: \`${userId}\`\nReason: ${reason}`);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed('❌ Kick Failed', err.message)] });
  }
}

async function handleSetBanner(interaction, cfg) {
  const url = interaction.options.getString('url', true);
  await interaction.deferReply({ ephemeral: true });

  try {
    await setBanner(cfg.apiKey, cfg.baseUrl, url);
    await interaction.editReply({ embeds: [successEmbed('🖼️ Banner Set', 'Server banner has been updated.')] });
  } catch (err) {
    await interaction.editReply({ embeds: [errorEmbed('❌ Set Banner Failed', err.message)] });
  }
}
