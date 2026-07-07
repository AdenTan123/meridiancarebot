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
import { shutdownServer } from '../../utils/marizmaApi.js';

function fillTemplate(template, host, cohost) {
  return template
    .replace(/\{host\}/g, host)
    .replace(/\{cohost\}/g, cohost || 'None');
}

function buildSsuEmbed(title, description, color) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail('https://i.imgur.com/YourServerLogo.png')
    .setFooter({ text: 'Marizma SSU System' })
    .setTimestamp();
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

export default {
  data: new SlashCommandBuilder()
    .setName('marizma')
    .setDescription('Marizma Roblox server integration')
    .addSubcommand(sub =>
      sub.setName('setup').setDescription('Configure Marizma integration settings'),
    )
    .addSubcommand(sub =>
      sub
        .setName('startup')
        .setDescription('Start an SSU session')
        .addUserOption(o => o.setName('host').setDescription('Session host').setRequired(true))
        .addUserOption(o => o.setName('cohost').setDescription('Session co-host').setRequired(false)),
    )
    .addSubcommand(sub =>
      sub.setName('shutdown').setDescription('Shutdown the current SSU session'),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      return handleSetup(interaction);
    }

    const cfg = await getMarizmaConfig(interaction.guildId);

    if (!cfg || !cfg.apiKey || !cfg.baseUrl) {
      await interaction.reply({ content: '❌ Please run `/marizma setup` first.', ephemeral: true });
      return;
    }

    if (sub === 'startup') {
      return handleStartup(interaction, cfg);
    }

    if (sub === 'shutdown') {
      return handleShutdown(interaction, cfg);
    }
  },
};

async function handleSetup(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('marizma_setup_modal')
    .setTitle('Marizma Setup — Step 1');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('apiKey')
        .setLabel('API Key')
        .setStyle(TextInputStyle.Short)
        .setRequired(true),
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('baseUrl')
        .setLabel('Base URL')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://api.yourmarizmainstance.com')
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

async function handleStartup(interaction, cfg) {
  const host = interaction.options.getUser('host');
  const cohost = interaction.options.getUser('cohost');
  const channelId = cfg.sessionsChannel;

  if (!channelId) {
    await interaction.reply({ content: '❌ No Sessions Channel configured. Run `/marizma setup`.', ephemeral: true });
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
  );
  await channel.send({ embeds: [embed] });

  await interaction.editReply({ content: '✅ SSU startup complete. Channel purged and messages sent.' });
}

async function handleShutdown(interaction, cfg) {
  const channelId = cfg.sessionsChannel;
  if (!channelId) {
    await interaction.reply({ content: '❌ No Sessions Channel configured.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await shutdownServer(cfg.apiKey, cfg.baseUrl);
    console.log('Shutdown API response:', result);
  } catch (err) {
    console.error('Shutdown API error:', err.message);
  }

  const channel = await interaction.guild.channels.fetch(channelId);
  if (channel) {
    await purgeChannel(channel);

    const shutdownMsg = fillTemplate(cfg.shutdownTemplate, 'Server', '');
    await channel.send(shutdownMsg);

    const embed = buildSsuEmbed(
      '🛑 SSU Session Ended',
      'The session has been shut down. Thank you for participating!',
      Colors.Red,
    );
    await channel.send({ embeds: [embed] });
  }

  await interaction.editReply({ content: '✅ Shutdown process completed.' });
}
