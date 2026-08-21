import {
  Activity,
  BookOpen,
  CheckCircle2,
  Compass,
  FileText,
  FileType2,
  Footprints,
  Headphones,
  HelpCircle,
  ListChecks,
  LogIn,
  LogOut,
  NotebookPen,
  Sprout,
  Video,
  Waves,
  type LucideIcon,
} from "lucide-react";

/** Ícone por tipo de conteúdo da biblioteca. */
export const ICONE_TIPO: Record<string, LucideIcon> = {
  video: Video,
  audio: Headphones,
  meditacao: Waves,
  aterramento: Footprints,
  movimento_sistemico: Activity,
  exercicio: ListChecks,
  texto: FileText,
  texto_educativo: BookOpen,
  diario_integracao: NotebookPen,
  pergunta_reflexiva: HelpCircle,
  checkin: LogIn,
  checkout: LogOut,
  acao_alinhada: Compass,
  pratica_semanal: CheckCircle2,
  tarefa: Sprout,
  pdf: FileType2,
};

export function iconeDoTipo(tipo: string): LucideIcon {
  return ICONE_TIPO[tipo] ?? FileText;
}
