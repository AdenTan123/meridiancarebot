import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';

export default {
  name: 'marizma_continue_setup',
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('marizma_setup_modal_step2')
      .setTitle('Marizma Setup — Step 2');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('startupTemplate')
          .setLabel('SSU Startup Message Template')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('SSU has started! Host: {host}, Co-host: {cohost}')
          .setRequired(false),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('shutdownTemplate')
          .setLabel('SSU Shutdown Message Template')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('The SSU session has ended. Thanks for playing!')
          .setRequired(false),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('sessionsChannel')
          .setLabel('Sessions Channel ID')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('123456789012345678')
          .setRequired(false),
      ),
    );

    await interaction.showModal(modal);
  },
};
