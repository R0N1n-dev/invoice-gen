/**
 * Billfold icon set — Hugeicons (free set) behind a tiny Vue wrapper so templates
 * keep the familiar `<Plus :size="16" />` shape.
 */
import { defineComponent, h } from 'vue'
import { HugeiconsIcon, type IconArray } from '@hugeicons/vue'
import {
  Alert02Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BookPlusIcon,
  Building02Icon,
  Cancel01Icon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Copy01Icon,
  CreditCardIcon,
  Database01Icon,
  Delete02Icon,
  Download01Icon,
  File01Icon,
  FileDownloadIcon,
  Home01Icon,
  Image01Icon,
  InformationCircleIcon,
  Invoice01Icon,
  PackageIcon,
  PaletteIcon,
  PencilEdit02Icon,
  PlusSignIcon,
  RefreshIcon,
  Search01Icon,
  SecurityCheckIcon,
  SentIcon,
  Settings01Icon,
  Share08Icon,
  Tick02Icon,
  Upload01Icon,
  UserAdd01Icon,
  UserGroupIcon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons'

type IconData = readonly (readonly [string, { readonly [key: string]: string | number }])[]

function makeIcon(data: IconData) {
  return defineComponent({
    name: 'BillfoldIcon',
    inheritAttrs: false,
    props: {
      size: { type: [Number, String], default: 18 },
      strokeWidth: { type: Number, default: 1.7 },
    },
    setup(props, { attrs }) {
      return () =>
        h(HugeiconsIcon, {
          icon: data as unknown as IconArray,
          size: props.size,
          strokeWidth: props.strokeWidth,
          ...attrs,
        })
    },
  })
}

export const Home = makeIcon(Home01Icon)
export const Dashboard = makeIcon(Analytics01Icon)
export const Invoices = makeIcon(Invoice01Icon)
export const Clients = makeIcon(UserGroupIcon)
export const Items = makeIcon(PackageIcon)
export const Settings = makeIcon(Settings01Icon)

export const ArrowLeft = makeIcon(ArrowLeft01Icon)
export const ArrowRight = makeIcon(ArrowRight01Icon)
export const ChevronDown = makeIcon(ArrowDown01Icon)

export const Plus = makeIcon(PlusSignIcon)
export const Check = makeIcon(Tick02Icon)
export const CircleCheck = makeIcon(CheckmarkCircle02Icon)
export const BadgeCheck = makeIcon(CheckmarkBadge01Icon)
export const TriangleAlert = makeIcon(Alert02Icon)
export const Info = makeIcon(InformationCircleIcon)
export const X = makeIcon(Cancel01Icon)

export const Search = makeIcon(Search01Icon)
export const Clock = makeIcon(Clock01Icon)
export const BookPlus = makeIcon(BookPlusIcon)
export const Copy = makeIcon(Copy01Icon)
export const Pencil = makeIcon(PencilEdit02Icon)
export const Trash2 = makeIcon(Delete02Icon)
export const Download = makeIcon(Download01Icon)
export const FileDown = makeIcon(FileDownloadIcon)
export const FileText = makeIcon(File01Icon)
export const Upload = makeIcon(Upload01Icon)
export const Share2 = makeIcon(Share08Icon)
export const Send = makeIcon(SentIcon)
export const RotateCcw = makeIcon(RefreshIcon)
export const CreditCard = makeIcon(CreditCardIcon)
export const Wallet = makeIcon(Wallet01Icon)
export const Users = makeIcon(UserGroupIcon)
export const UserPlus = makeIcon(UserAdd01Icon)
export const Package = makeIcon(PackageIcon)
export const Building2 = makeIcon(Building02Icon)
export const Palette = makeIcon(PaletteIcon)
export const Database = makeIcon(Database01Icon)
export const ShieldCheck = makeIcon(SecurityCheckIcon)
export const Image = makeIcon(Image01Icon)
export const ChartNoAxesCombined = makeIcon(Analytics01Icon)
