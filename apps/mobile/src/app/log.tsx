import {
  ACTIVITY_TYPES,
  createActivitySchema,
  PEST_SEVERITIES,
  type ActivityType,
  type PestSeverity,
} from '@furrow/shared';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCreateActivity, useIsOnline, usePlots } from '@/api/hooks';
import { ACTIVITY_META } from '@/components/activity-row';
import { Button, IconButton } from '@/components/button';
import { Celebration } from '@/components/celebration';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { CropMascot } from '@/components/mascot';
import { PressableScale } from '@/components/pressable-scale';
import { Segmented } from '@/components/segmented';
import { Stepper } from '@/components/stepper';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { formatDuration, formatNumber, formatVolume } from '@/lib/format';
import { cropKind } from '@/lib/semantics';
import { colors, radius, space } from '@/theme/tokens';

const WHEN_OPTIONS = [
  { minutes: 0, label: 'Now' },
  { minutes: 30, label: '30 min ago' },
  { minutes: 60, label: '1 h ago' },
  { minutes: 180, label: '3 h ago' },
];

const FERTILIZERS = [
  'NPK 20-20-20',
  'Urea 46-0-0',
  'Potassium sulfate',
  'Calcium nitrate',
  'Compost',
];

const PESTS: Record<string, string[]> = {
  tomato: ['Whitefly', 'Tuta absoluta', 'Spider mites', 'Early blight'],
  cucumber: ['Whitefly', 'Powdery mildew', 'Aphids', 'Thrips'],
  lettuce: ['Aphids', 'Downy mildew', 'Leaf miner'],
  'date-palm': ['Red palm weevil', 'Dubas bug', 'Lesser date moth'],
};

interface SavedEntry {
  type: ActivityType;
  plotName: string;
  cropId: string;
  detail: string;
  offline: boolean;
}

const SUCCESS_TITLE: Record<ActivityType, (plot: string) => string> = {
  irrigation: (plot) => `${plot} is drinking!`,
  fertilizer: (plot) => `${plot} got a snack!`,
  pest: () => 'Thanks for the heads-up',
  note: () => 'Note saved',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading">{title}</Text>
      {children}
    </View>
  );
}

function SuccessView({ saved, onDone }: { saved: SavedEntry; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  return (
    <View
      style={styles.screen}
      onLayout={(e) =>
        setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }>
      {size ? (
        <Celebration
          width={size.width}
          height={size.height}
          drops={saved.type === 'irrigation'}
          centerY={size.height * 0.3}
        />
      ) : null}
      <View style={styles.successBody} accessibilityLiveRegion="polite">
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <CropMascot crop={cropKind(saved.cropId)} mood="cheer" size={150} />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(150)} style={styles.successText}>
          <Text variant="display" align="center">
            {SUCCESS_TITLE[saved.type](saved.plotName)}
          </Text>
          <Text variant="bodyMedium" color="inkMuted" align="center" numberOfLines={2}>
            {saved.detail}
          </Text>
          <View
            style={[
              styles.syncPill,
              { backgroundColor: saved.offline ? colors.grapeTint : colors.leafTint },
            ]}>
            <Icon
              name={saved.offline ? 'cloudOff' : 'sync'}
              size={15}
              weight="bold"
              color={saved.offline ? colors.grapeText : colors.leafText}
            />
            <Text variant="smallMedium" color={saved.offline ? 'grapeText' : 'leafText'}>
              {saved.offline
                ? 'Saved on this phone · syncs when online'
                : 'Saved · syncing to the farm'}
            </Text>
          </View>
        </Animated.View>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button label="Back to farm" onPress={onDone} />
      </View>
    </View>
  );
}

export default function LogScreen() {
  const params = useLocalSearchParams<{ plotId?: string; type?: string; durationMin?: string }>();
  const router = useRouter();
  const plots = usePlots();
  const online = useIsOnline();
  const createActivity = useCreateActivity();
  const insets = useSafeAreaInsets();

  const [plotId, setPlotId] = useState<string | null>(params.plotId ?? null);
  const [type, setType] = useState<ActivityType>(
    ACTIVITY_TYPES.includes(params.type as ActivityType)
      ? (params.type as ActivityType)
      : 'irrigation',
  );
  const [whenMinutes, setWhenMinutes] = useState(0);
  const [durationMin, setDurationMin] = useState(() => {
    const fromParams = Number(params.durationMin);
    return Number.isFinite(fromParams) && fromParams > 0 ? Math.min(720, fromParams) : 60;
  });
  const [product, setProduct] = useState('');
  const [amount, setAmount] = useState(10);
  const [unit, setUnit] = useState<'kg' | 'L'>('kg');
  const [pestName, setPestName] = useState('');
  const [severity, setSeverity] = useState<PestSeverity>('low');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedEntry | null>(null);

  const plot = plots.data?.plots.find((p) => p.id === plotId) ?? null;
  const flowRate = plot?.recommendation.inputs.flowRateLph ?? null;

  if (saved) return <SuccessView saved={saved} onDone={router.back} />;

  const save = () => {
    const problem = !plotId
      ? 'Choose a plot first.'
      : type === 'fertilizer' && !product.trim()
        ? 'Enter the fertilizer product.'
        : type === 'pest' && !pestName.trim()
          ? 'Name the pest or disease.'
          : type === 'note' && !text.trim()
            ? 'Write the note.'
            : null;
    if (problem) {
      setError(problem);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const details =
      type === 'irrigation'
        ? { durationMin }
        : type === 'fertilizer'
          ? { product: product.trim(), amount, unit }
          : type === 'pest'
            ? { name: pestName.trim(), severity }
            : { text: text.trim() };

    const parsed = createActivitySchema.safeParse({
      id: Crypto.randomUUID(),
      plotId,
      type,
      occurredAt: new Date(Date.now() - whenMinutes * 60_000).toISOString(),
      details,
      note: type !== 'note' && note.trim() ? note.trim() : undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    createActivity.mutate(parsed.data);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved({
      type,
      plotName: plot?.name ?? 'Your plot',
      cropId: plot?.crop.id ?? 'lettuce',
      offline: !online,
      detail:
        type === 'irrigation'
          ? `${formatDuration(durationMin)}${flowRate ? ` · ${formatVolume((durationMin / 60) * flowRate)}` : ''} of water logged`
          : type === 'fertilizer'
            ? `${product.trim()} · ${amount} ${unit}`
            : type === 'pest'
              ? `${pestName.trim()} · ${severity} severity`
              : text.trim(),
    });
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text variant="display" accessibilityRole="header">
            Log activity
          </Text>
          <IconButton icon="close" label="Close" onPress={router.back} />
        </View>

        <Section title="Which plot?">
          <View style={styles.wrap}>
            {plots.data ? (
              plots.data.plots.map((p) => (
                <Chip
                  key={p.id}
                  label={p.name}
                  selected={p.id === plotId}
                  onPress={() => {
                    setPlotId(p.id);
                    setError(null);
                  }}
                />
              ))
            ) : (
              <Text variant="small" color="inkMuted">
                Plots load once the app has connected at least once.
              </Text>
            )}
          </View>
        </Section>

        <Section title="What did you do?">
          <View style={styles.tiles} accessibilityRole="radiogroup">
            {ACTIVITY_TYPES.map((value) => {
              const meta = ACTIVITY_META[value];
              const selected = value === type;
              return (
                <PressableScale
                  key={value}
                  haptic
                  onPress={() => {
                    setType(value);
                    setError(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={meta.label}
                  style={[styles.tile, selected && styles.tileSelected]}>
                  <View style={[styles.tileIcon, { backgroundColor: colors[meta.tint] }]}>
                    <Icon name={meta.icon} size={22} weight="fill" color={colors[meta.color]} />
                  </View>
                  <Text variant="bodyMedium">{meta.label}</Text>
                </PressableScale>
              );
            })}
          </View>
        </Section>

        <Section title="When?">
          <View style={styles.wrap}>
            {WHEN_OPTIONS.map((option) => (
              <Chip
                key={option.minutes}
                label={option.label}
                selected={whenMinutes === option.minutes}
                onPress={() => setWhenMinutes(option.minutes)}
              />
            ))}
          </View>
        </Section>

        {type === 'irrigation' ? (
          <Section title="How long?">
            <Stepper
              label="Watering run time"
              value={durationMin}
              onChange={setDurationMin}
              step={15}
              min={15}
              max={720}
              format={formatDuration}
            />
            {flowRate ? (
              <Text variant="smallMedium" color="skyText" align="center">
                About {formatVolume((durationMin / 60) * flowRate)} at{' '}
                {formatNumber(flowRate / 1000, 1)} m³/h
              </Text>
            ) : null}
          </Section>
        ) : null}

        {type === 'fertilizer' ? (
          <Section title="What did it get?">
            <TextField
              label="Product"
              value={product}
              onChangeText={setProduct}
              placeholder="NPK 20-20-20"
              returnKeyType="done"
            />
            <View style={styles.wrap}>
              {FERTILIZERS.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  selected={product === name}
                  onPress={() => setProduct(name)}
                />
              ))}
            </View>
            <View style={styles.amountRow}>
              <View style={styles.amountStepper}>
                <Stepper
                  label="Amount"
                  value={amount}
                  onChange={setAmount}
                  step={unit === 'kg' ? 5 : 1}
                  min={unit === 'kg' ? 5 : 1}
                  max={5000}
                  format={(v) => `${v} ${unit}`}
                />
              </View>
              <Segmented
                accessibilityLabel="Unit"
                value={unit}
                onChange={setUnit}
                options={[
                  { value: 'kg', label: 'kg' },
                  { value: 'L', label: 'L' },
                ]}
              />
            </View>
          </Section>
        ) : null}

        {type === 'pest' ? (
          <Section title="What did you see?">
            <TextField
              label="Pest or disease"
              value={pestName}
              onChangeText={setPestName}
              placeholder="Whitefly"
              returnKeyType="done"
            />
            <View style={styles.wrap}>
              {(
                PESTS[plot?.crop.id ?? ''] ?? [
                  'Whitefly',
                  'Aphids',
                  'Spider mites',
                  'Red palm weevil',
                ]
              ).map((name) => (
                <Chip
                  key={name}
                  label={name}
                  selected={pestName === name}
                  onPress={() => setPestName(name)}
                />
              ))}
            </View>
            <View style={styles.severity}>
              <Text variant="smallMedium" color="inkMuted">
                How bad?
              </Text>
              <Segmented
                accessibilityLabel="Severity"
                value={severity}
                onChange={setSeverity}
                options={PEST_SEVERITIES.map((value) => ({
                  value,
                  label: value[0]!.toUpperCase() + value.slice(1),
                }))}
              />
            </View>
          </Section>
        ) : null}

        {type === 'note' ? (
          <Section title="Your note">
            <TextField
              label="Note"
              value={text}
              onChangeText={setText}
              placeholder="Drip line 4 is leaking near the gate"
              multiline
            />
          </Section>
        ) : (
          <TextField
            label="Anything else? (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Anything worth remembering"
            multiline
          />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {error ? (
          <View style={styles.error} accessibilityLiveRegion="assertive">
            <Icon name="warning" size={16} weight="bold" color={colors.danger} />
            <Text variant="smallMedium" color="danger">
              {error}
            </Text>
          </View>
        ) : null}
        <Button
          label={online ? 'Save' : 'Save offline'}
          icon={online ? undefined : 'cloudOff'}
          onPress={save}
        />
        {!online ? (
          <Text variant="small" color="inkMuted" align="center">
            You&apos;re offline. This entry stays on the phone and syncs automatically.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: space.xl, paddingTop: space.xxl, gap: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tileSelected: { borderColor: colors.leaf, backgroundColor: colors.leafTint },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  amountStepper: { flex: 1 },
  severity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  footer: {
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: 2,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  successBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  successText: { alignItems: 'center', gap: space.sm },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    marginTop: space.xs,
  },
});
