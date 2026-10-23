// Deep imports: the package barrel pulls in all ~1,500 icons.
import type { IconWeight } from 'phosphor-react-native';
import { ArrowsClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { BugIcon } from 'phosphor-react-native/src/icons/Bug';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CaretUpIcon } from 'phosphor-react-native/src/icons/CaretUp';
import { CellSignalSlashIcon } from 'phosphor-react-native/src/icons/CellSignalSlash';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { CloudRainIcon } from 'phosphor-react-native/src/icons/CloudRain';
import { CloudSlashIcon } from 'phosphor-react-native/src/icons/CloudSlash';
import { CloudSunIcon } from 'phosphor-react-native/src/icons/CloudSun';
import { DropIcon } from 'phosphor-react-native/src/icons/Drop';
import { FlaskIcon } from 'phosphor-react-native/src/icons/Flask';
import { LeafIcon } from 'phosphor-react-native/src/icons/Leaf';
import { MinusIcon } from 'phosphor-react-native/src/icons/Minus';
import { MoonStarsIcon } from 'phosphor-react-native/src/icons/MoonStars';
import { NotePencilIcon } from 'phosphor-react-native/src/icons/NotePencil';
import { PauseCircleIcon } from 'phosphor-react-native/src/icons/PauseCircle';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { WavesIcon } from 'phosphor-react-native/src/icons/Waves';
import { XIcon } from 'phosphor-react-native/src/icons/X';

import { colors } from '@/theme/tokens';

const ICONS = {
  back: CaretLeftIcon,
  bug: BugIcon,
  check: CheckCircleIcon,
  chevronDown: CaretDownIcon,
  chevronRight: CaretRightIcon,
  chevronUp: CaretUpIcon,
  clock: ClockIcon,
  close: XIcon,
  cloudOff: CloudSlashIcon,
  cloudSun: CloudSunIcon,
  drop: DropIcon,
  flask: FlaskIcon,
  leaf: LeafIcon,
  minus: MinusIcon,
  moon: MoonStarsIcon,
  note: NotePencilIcon,
  pause: PauseCircleIcon,
  plus: PlusIcon,
  rain: CloudRainIcon,
  signalOff: CellSignalSlashIcon,
  sun: SunIcon,
  sync: ArrowsClockwiseIcon,
  warning: WarningIcon,
  waves: WavesIcon,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color = colors.ink,
  weight = 'regular',
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: IconWeight;
}) {
  const Component = ICONS[name];
  return <Component size={size} color={color} weight={weight} />;
}
