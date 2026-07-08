import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { getMarizmaConfig } from '../../utils/database.js';

export default {
  name: 'marizma_continue_setup',
  async execute(interaction) {
    const cfg = await getMarizmaConfig(interaction.guildId);

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

    if (cfg) {
      if (cfg.startupTemplate) startupTemplateInput.setValue(cfg.startupTemplate);
      if (cfg.shutdownTemplate) shutdownTemplateInput.setValue(cfg.shutdownTemplate);
      if (cfg.sessionsChannel) sessionsChannelInput.setValue(cfg.sessionsChannel);
    }

    const modal = new ModalBuilder()
      .setCustomId('marizma_setup_modal_step2')
      .setTitle('Marizma Setup — Step 2');

    modal.addComponents(
      new ActionRowBuilder().addComponents(startupTemplateInput),
      new ActionRowBuilder().addComponents(shutdownTemplateInput),
      new ActionRowBuilder().addComponents(sessionsChannelInput),
    );

    await interaction.showModal(modal);
  },
};
