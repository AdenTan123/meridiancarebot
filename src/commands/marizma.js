import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  Colors,
  ChannelType,
} from 'discord.js';
import { getMarizmaConfig, setMarizmaConfig } from '../utils/database.js';
import { shutdownServer } from '../utils/marizmaApi.js';

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

async function handleSetup(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('marizma_setup_modal')
    .setTitle('Marizma Configuration');

  const apiKeyInput = new TextInputBuilder()
    .setCustomId('apiKey')
    .setLabel('API Key')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const baseUrlInput = new TextInputBuilder()
    .setCustomId('baseUrl')
    .setLabel('Base URL')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://api.yourmarizmainstance.com')
    .setRequired(true);

  const modRolesInput = new TextInputBuilder()
    .setCustomId('modRoles')
    .setLabel('Moderation Roles (comma-separated IDs)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const startupTemplateInput = new TextInputBuilder()
    .setCustomId('startupTemplate')
    .setLabel('SSU Startup Message Template')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('SSU has started! Host: {host}, Co-host: {cohost}')
    .setRequired(false);

  const shutdownTemplateInput = new TextInputBuilder()
    .setCustomId('shutdownTemplate')
    .setLabel('SSU Shutdown Message Template')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('The SSU session has ended. Thanks for playing!')
    .setRequired(false);

  const sessionsChannelInput = new TextInputBuilder()
    .setCustomId('sessionsChannel')
    .setLabel('Sessions Channel ID')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('123456789012345678')
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(apiKeyInput),
    new ActionRowBuilder().addComponents(baseUrlInput),
    new ActionRowBuilder().addComponents(modRolesInput),
    new ActionRowBuilder().addComponents(startupTemplateInput),
    new ActionRowBuilder().addComponents(shutdownTemplateInput),
    new ActionRowBuilder().addComponents(sessionsChannelInput),
  );

  await interaction.showModal(modal);
}

async function handleSetupModalSubmit(interaction) {
  const guildId = interaction.guildId;
  const raw = interaction.fields;

  const config = {
    apiKey: raw.getTextInputValue('apiKey'),
    baseUrl: raw.getTextInputValue('baseUrl'),
    modRoles: raw.getTextInputValue('modRoles') || null,
    startupTemplate: raw.getTextInputValue('startupTemplate') || 'SSU is now live! Host: {host}, Co-host: {cohost}',
    shutdownTemplate: raw.getTextInputValue('shutdownTemplate') || 'The SSU session has ended. Thank you for participating!',
    sessionsChannel: raw.getTextInputValue('sessionsChannel') || null,
  };

  if (config.sessionsChannel) {
    const ch = await interaction.guild.channels.fetch(config.sessionsChannel).catch(() => null);
    if (!ch || ch.type !== ChannelType.GuildText) {
      await interaction.reply({ content: '❌ Sessions Channel ID is invalid or not a text channel.', ephemeral: true });
      return;
    }
  }

  await setMarizmaConfig(guildId, config);
  await interaction.reply({ content: '✅ Marizma configuration saved successfully!', ephemeral: true });
}

async function handleStartup(interaction) {
  const guildId = interaction.guildId;
  const cfg = await getMarizmaConfig(guildId);

  if (!cfg || !cfg.apiKey || !cfg.baseUrl) {
    await interaction.reply({ content: '❌ Please run `/marizma setup` first.', ephemeral: true });
    return;
  }

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

async function handleShutdown(interaction) {
  const guildId = interaction.guildId;
  const cfg = await getMarizmaConfig(guildId);

  if (!cfg || !cfg.apiKey || !cfg.baseUrl) {
    await interaction.reply({ content: '❌ Please run `/marizma setup` first.', ephemeral: true });
    return;
  }

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

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'setup':
      return handleSetup(interaction);
    case 'startup':
      return handleStartup(interaction);
    case 'shutdown':
      return handleShutdown(interaction);
    default:
      await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  }
}

export async function handleModal(interaction) {
  if (interaction.customId === 'marizma_setup_modal') {
    return handleSetupModalSubmit(interaction);
  }
}
