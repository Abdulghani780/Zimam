/**
 * Asaas UI kit: Thmanyah type, brand tokens, liquid-glass components and the
 * assistant widget. Import the styles once (main.tsx): `import './asaas-ui/styles/index.css'`.
 */
export { Ambient } from './ui/Ambient';
export { Button, type ButtonProps } from './ui/Button';
export { ConfirmDialog } from './ui/ConfirmDialog';
export { EmptyState, ErrorState, Skeleton } from './ui/Feedback';
export { Field, FormError, MoneyInput, Select, TextArea, TextInput, type FieldProps, type TextInputProps } from './ui/Field';
export { Card, Glass } from './ui/Glass';
export { Icon, type IconName } from './ui/Icon';
export { Modal, type ModalProps } from './ui/Modal';
export { MonthSwitcher } from './ui/MonthSwitcher';
export { PasswordInput, PasswordStrength, type PasswordInputProps } from './ui/PasswordInput';
export { Segmented } from './ui/Segmented';
export { SiteHeader, type SiteHeaderProps, TabBar } from './ui/SiteHeader';
export { ProgressBar, ProgressRing, Stat } from './ui/Stat';
export { Avatar, type ContributionStatus, STATUS_META, StatusPill } from './ui/Status';
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContainer,
  TableEmpty,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type TableRowProps,
} from './ui/Table';
export { ToastProvider, useToast } from './ui/Toast';
export { Stretch, Swash, swashIndex } from './ui/Typography';

export { cx } from './lib/cx';
export { type KitLang, type KitTextKey, kitLang, kitText, setKitText } from './lib/i18n';
export { strengthLabel, type StrengthLevel } from './lib/passwordStrength';
export * from './lib/format';
export { currentPeriod, periodBounds, shiftPeriod, today } from './lib/period';
export { useTheme } from './lib/useTheme';

export { AssistantFace, AssistantRobot, greeting } from './assistant/AssistantAvatar';
export type { AssistantAnswer, AssistantConfig, AssistantMessage } from './assistant/AssistantPanel';
export { AssistantWidget } from './assistant/AssistantWidget';
