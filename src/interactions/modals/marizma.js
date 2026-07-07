import { ChannelType } from 'discord.js';
import { setMarizmaConfig } from '../../utils/database.js';

export default {
  name: 'marizma_setup_modal',
  async execute(interaction) {
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
  },
};
