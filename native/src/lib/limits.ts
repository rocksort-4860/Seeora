/**
 * 产品业务边界常量（纯值，零依赖）
 *
 * 单独成文件而不是放在 useHabitActions 里：该常量同时被「行为层」和「页面层」使用，
 * 放在行为模块会让 pro.tsx / today.tsx 仅为取一个数字就拉入 notify / haptic 等运行时依赖。
 */
/** 免费版习惯数量上限（买断后不限） */
export const FREE_HABIT_LIMIT = 5;
