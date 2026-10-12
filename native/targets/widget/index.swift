import WidgetKit
import SwiftUI

// MARK: - 共享数据模型（与主 App src/lib/widgetSync.ts 的快照结构严格一致）

struct WidgetHabit: Codable {
    let emoji: String
    let name: String
    let color: String
    let state: String // "done" | "open" | "rest"
}

struct WidgetSnapshot: Codable {
    let date: String   // YYYY-MM-DD（主 App 写入时的「今天」）
    let done: Int
    let total: Int
    let habits: [WidgetHabit]
}

// MARK: - Timeline

struct SeeoraEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct SeeoraProvider: TimelineProvider {
    private let suiteName = "group.com.seeora.app"
    private let snapshotKey = "widget_snapshot"

    private func loadSnapshot() -> WidgetSnapshot? {
        guard let raw = UserDefaults(suiteName: suiteName)?.string(forKey: snapshotKey),
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    func placeholder(in context: Context) -> SeeoraEntry {
        SeeoraEntry(date: Date(), snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SeeoraEntry) -> Void) {
        completion(SeeoraEntry(date: Date(), snapshot: loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SeeoraEntry>) -> Void) {
        let entry = SeeoraEntry(date: Date(), snapshot: loadSnapshot())
        // 下一次系统刷新：次日 0 点（打卡变化的即时刷新由主 App WidgetCenter.reloadAllTimelines 触发）
        let tomorrow = Calendar.current.startOfDay(for: Date()).addingTimeInterval(86_400)
        completion(Timeline(entries: [entry], policy: .after(tomorrow)))
    }
}

// MARK: - 颜色

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        if s.count == 3 { s = s.map { "\($0)\($0)" }.joined() }
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        self.init(
            red: Double((v >> 16) & 0xFF) / 255,
            green: Double((v >> 8) & 0xFF) / 255,
            blue: Double(v & 0xFF) / 255
        )
    }

    static let seeoraAccent = Color(hex: "2d7a6b")
    static let seeoraCream = Color(hex: "FAF9F4")
    static let seeoraInk = Color(hex: "2a2a28")
    static let seeoraInk3 = Color(hex: "8a8a85")
}

// MARK: - 视图

private struct ProgressRing: View {
    let done: Int
    let total: Int

    private var progress: Double {
        total > 0 ? Double(done) / Double(total) : 0
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.seeoraAccent.opacity(0.18), lineWidth: 7)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(Color.seeoraAccent, style: StrokeStyle(lineWidth: 7, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(done)/\(total)")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.seeoraInk)
                Text("today")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(Color.seeoraInk3)
            }
        }
    }
}

private struct HabitRow: View {
    let habit: WidgetHabit

    var body: some View {
        HStack(spacing: 8) {
            Text(habit.emoji)
                .font(.system(size: 15))
            Text(habit.name)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.seeoraInk)
                .lineLimit(1)
            Spacer(minLength: 4)
            switch habit.state {
            case "done":
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color(hex: habit.color))
                    .font(.system(size: 15))
            case "rest":
                Image(systemName: "moon.fill")
                    .foregroundStyle(Color.seeoraInk3)
                    .font(.system(size: 12))
            default:
                Image(systemName: "circle")
                    .foregroundStyle(Color.seeoraInk3.opacity(0.6))
                    .font(.system(size: 15))
            }
        }
    }
}

private struct EmptyState: View {
    var body: some View {
        VStack(spacing: 6) {
            Text("🌱")
                .font(.system(size: 26))
            Text("Open Seeora to start")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.seeoraInk3)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct SeeoraWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: SeeoraEntry

    var body: some View {
        if let snap = entry.snapshot, snap.total > 0 {
            switch family {
            case .systemMedium:
                HStack(spacing: 14) {
                    ProgressRing(done: snap.done, total: snap.total)
                        .frame(width: 86, height: 86)
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(snap.habits.prefix(3).enumerated()), id: \.offset) { _, h in
                            HabitRow(habit: h)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 14)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            default:
                VStack(spacing: 8) {
                    ProgressRing(done: snap.done, total: snap.total)
                        .frame(width: 74, height: 74)
                    if let first = snap.habits.first {
                        HabitRow(habit: first)
                            .padding(.horizontal, 10)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        } else {
            EmptyState()
        }
    }
}

// MARK: - Widget

struct SeeoraWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SeeoraWidget", provider: SeeoraProvider()) { entry in
            SeeoraWidgetView(entry: entry)
                .containerBackground(Color.seeoraCream, for: .widget)
        }
        .configurationDisplayName("Seeora")
        .description("Today's habits at a glance — gentle routines, no guilt.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct SeeoraWidgetBundle: WidgetBundle {
    var body: some Widget {
        SeeoraWidget()
    }
}
