import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { saveCountingGameConfig, getCountingGameConfig, disableCountingGame } from '../../services/countingGameService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('count')
    .setDescription('Manage the counting game')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Set up the counting channel')
        .addChannelOption(o =>
          o.setName('channel').setDescription('The channel for counting').setRequired(true).addChannelTypes(ChannelType.GuildText),
        )
        .addBooleanOption(o =>
          o.setName('onlynumbers').setDescription('Delete messages that are not valid counts').setRequired(true),
        )
        .addBooleanOption(o =>
          o.setName('mathexpressions').setDescription('Allow math expressions like 1+1=2 as valid counts').setRequired(true),
        ),
    )
    .addSubcommand(sub =>
      sub.setName('disable').setDescription('Disable the counting game'),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'disable') {
      await disableCountingGame(interaction.client, interaction.guildId);
      await interaction.reply({ content: '✅ Counting game disabled.', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);
    const onlyNumbers = interaction.options.getBoolean('onlynumbers', true);
    const mathExpressions = interaction.options.getBoolean('mathexpressions', true);

    const existing = await getCountingGameConfig(interaction.client, interaction.guildId);
    if (existing.enabled && existing.channelId === channel.id) {
      await interaction.reply({ content: '❌ Counting is already set up in that channel.', ephemeral: true });
      return;
    }

    await saveCountingGameConfig(interaction.client, interaction.guildId, {
      enabled: true,
      channelId: channel.id,
      system: 'decimal',
      nextNumber: 1,
      lastUserId: null,
      currentStreak: 0,
      bestStreak: existing.bestStreak || 0,
      leaderboard: existing.leaderboard || {},
      onlyNumbers,
      mathExpressions,
    });

    await interaction.reply({
      content: `✅ Counting game set up in ${channel}.\n• Only Numbers: ${onlyNumbers ? 'ON' : 'OFF'}\n• Math Expressions: ${mathExpressions ? 'ON' : 'OFF'}`,
      ephemeral: true,
    });
  },
};
