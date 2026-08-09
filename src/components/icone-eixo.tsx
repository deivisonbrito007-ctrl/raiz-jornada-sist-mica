import {
  Activity,
  Anchor,
  Baby,
  BookOpen,
  Brain,
  Compass,
  Coins,
  Feather,
  Flame,
  Flower,
  Footprints,
  Gem,
  HandHeart,
  Handshake,
  Heart,
  HeartHandshake,
  Home,
  Leaf,
  LifeBuoy,
  Lightbulb,
  Moon,
  Mountain,
  Music,
  NotebookPen,
  Palette,
  Rainbow,
  Route,
  Shield,
  Smile,
  Sparkles,
  Sprout,
  Star,
  Sun,
  Trees,
  UserRound,
  Users,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapa explícito de ícones por nome (kebab-case) usado pelos eixos.
 * Evita importar a biblioteca de ícones inteira no pacote inicial do cliente.
 */
const ICONES: Record<string, LucideIcon> = {
  activity: Activity,
  anchor: Anchor,
  baby: Baby,
  "book-open": BookOpen,
  brain: Brain,
  coins: Coins,
  compass: Compass,
  feather: Feather,
  flame: Flame,
  flower: Flower,
  footprints: Footprints,
  gem: Gem,
  "hand-heart": HandHeart,
  handshake: Handshake,
  heart: Heart,
  "heart-handshake": HeartHandshake,
  home: Home,
  leaf: Leaf,
  "life-buoy": LifeBuoy,
  lightbulb: Lightbulb,
  moon: Moon,
  mountain: Mountain,
  music: Music,
  "notebook-pen": NotebookPen,
  palette: Palette,
  rainbow: Rainbow,
  route: Route,
  shield: Shield,
  smile: Smile,
  sparkles: Sparkles,
  sprout: Sprout,
  star: Star,
  sun: Sun,
  trees: Trees,
  "user-round": UserRound,
  users: Users,
  waves: Waves,
  wind: Wind,
};

export function iconePorNome(nome: string | null | undefined): LucideIcon {
  if (!nome) return Sprout;
  return ICONES[nome.trim().toLowerCase()] ?? Sprout;
}

export function IconeEixo({ nome, className }: { nome: string; className?: string }) {
  const Componente = iconePorNome(nome);
  return <Componente className={className} aria-hidden="true" />;
}
