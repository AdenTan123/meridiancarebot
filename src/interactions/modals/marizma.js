import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChannelType,
} from 'discord.js';
import { getMarizmaConfig, setMarizmaConfig } from '../../utils/database.js';

const step1Handler = {
  name: 'marizma_setup_modal',
  async execute(interaction) {
    const guildId = interaction.guildId;
    const raw = interaction.fields;
    const existing = await getMarizmaConfig(guildId);

    const partial = {
      ...(existing || {}),
      apiKey: raw.getTextInputValue('apiKey'),
      baseUrl: raw.getTextInputValue('baseUrl'),
    };

    await setMarizmaConfig(guildId, partial);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('✅ Step 1 Complete')
      .setDescription('API connection details saved. Click below to configure messages and channel.')
      .addFields(
        { name: 'API Key', value: `\`${partial.apiKey.slice(0, 8)}…\``, inline: true },
        { name: 'Base URL', value: partial.baseUrl, inline: true },
      )
      .setFooter({ text: 'Marizma Setup' });

    const button = new ButtonBuilder()
      .setCustomId('marizma_continue_setup')
      .setLabel('Continue Setup →')
      .setStyle(ButtonStyle.Primary);

    await interaction.reply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(button)],
      ephemeral: true,
    });
  },
};

const step2Handler = {
  name: 'marizma_setup_modal_step2',
  async execute(interaction) {
    const guildId = interaction.guildId;
    const raw = interaction.fields;
    const existing = await getMarizmaConfig(guildId);

    const config = {
      ...(existing || {}),
      startupTemplate: raw.getTextInputValue('startupTemplate') || existing?.startupTemplate || 'SSU is now live! Host: {host}, Co-host: {cohost}',
      shutdownTemplate: raw.getTextInputValue('shutdownTemplate') || existing?.shutdownTemplate || 'The SSU session has ended. Thank you for participating!',
      sessionsChannel: raw.getTextInputValue('sessionsChannel') || existing?.sessionsChannel || null,
    };

    if (config.sessionsChannel) {
      const ch = await interaction.guild.channels.fetch(config.sessionsChannel).catch(() => null);
      if (!ch || ch.type !== ChannelType.GuildText) {
        await interaction.reply({ content: '❌ Sessions Channel ID is invalid or not a text channel.', ephemeral: true });
        return;
      }
    }

    await setMarizmaConfig(guildId, config);

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('✅ Setup Complete')
      .setDescription('Marizma is fully configured and ready to use.')
      .addFields(
        { name: 'SSU Startup Message', value: config.startupTemplate, inline: false },
        { name: 'SSU Shutdown Message', value: config.shutdownTemplate, inline: false },
        { name: 'Sessions Channel', value: config.sessionsChannel ? `<#${config.sessionsChannel}>` : 'Not set', inline: true },
      )
      .setFooter({ text: 'Marizma Setup' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default [step1Handler, step2Handler];
