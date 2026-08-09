export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      atribuicao_etapas: {
        Row: {
          atribuicao_id: string
          concluida_em: string | null
          conteudo_id: string
          created_at: string
          id: string
          obrigatoria: boolean
          ordem: number
        }
        Insert: {
          atribuicao_id: string
          concluida_em?: string | null
          conteudo_id: string
          created_at?: string
          id?: string
          obrigatoria?: boolean
          ordem?: number
        }
        Update: {
          atribuicao_id?: string
          concluida_em?: string | null
          conteudo_id?: string
          created_at?: string
          id?: string
          obrigatoria?: boolean
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "atribuicao_etapas_atribuicao_id_fkey"
            columns: ["atribuicao_id"]
            isOneToOne: false
            referencedRelation: "atribuicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atribuicao_etapas_conteudo_id_fkey"
            columns: ["conteudo_id"]
            isOneToOne: false
            referencedRelation: "conteudos"
            referencedColumns: ["id"]
          },
        ]
      }
      atribuicoes: {
        Row: {
          audio_path: string | null
          cliente_id: string
          created_at: string
          data_inicio: string
          data_revisao: string | null
          exige_acompanhamento: boolean
          frequencia: string
          id: string
          mensagem: string
          nivel: Database["public"]["Enums"]["nivel_profundidade"]
          objetivo: string
          observacoes: string
          orientacoes_especiais: string
          permite_repetir: boolean
          pode_sozinho: boolean
          somente_em_sessao: boolean
          status: Database["public"]["Enums"]["atribuicao_status"]
          terapeuta_id: string | null
          trilha_id: string
          updated_at: string
        }
        Insert: {
          audio_path?: string | null
          cliente_id: string
          created_at?: string
          data_inicio?: string
          data_revisao?: string | null
          exige_acompanhamento?: boolean
          frequencia?: string
          id?: string
          mensagem?: string
          nivel?: Database["public"]["Enums"]["nivel_profundidade"]
          objetivo?: string
          observacoes?: string
          orientacoes_especiais?: string
          permite_repetir?: boolean
          pode_sozinho?: boolean
          somente_em_sessao?: boolean
          status?: Database["public"]["Enums"]["atribuicao_status"]
          terapeuta_id?: string | null
          trilha_id: string
          updated_at?: string
        }
        Update: {
          audio_path?: string | null
          cliente_id?: string
          created_at?: string
          data_inicio?: string
          data_revisao?: string | null
          exige_acompanhamento?: boolean
          frequencia?: string
          id?: string
          mensagem?: string
          nivel?: Database["public"]["Enums"]["nivel_profundidade"]
          objetivo?: string
          observacoes?: string
          orientacoes_especiais?: string
          permite_repetir?: boolean
          pode_sozinho?: boolean
          somente_em_sessao?: boolean
          status?: Database["public"]["Enums"]["atribuicao_status"]
          terapeuta_id?: string | null
          trilha_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atribuicoes_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_acessos_negados: {
        Row: {
          acao: string
          alvo_id: string | null
          created_at: string
          detalhes: Json
          id: string
          permissao: string
          rota: string
          tipo: string
          user_email: string
          user_id: string | null
        }
        Insert: {
          acao: string
          alvo_id?: string | null
          created_at?: string
          detalhes?: Json
          id?: string
          permissao?: string
          rota?: string
          tipo?: string
          user_email?: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          alvo_id?: string | null
          created_at?: string
          detalhes?: Json
          id?: string
          permissao?: string
          rota?: string
          tipo?: string
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      auditoria_equipe: {
        Row: {
          acao: string
          alvo_email: string | null
          alvo_id: string | null
          alvo_tipo: string
          ator_email: string
          ator_id: string | null
          created_at: string
          detalhes: Json
          id: string
          motivo: string
        }
        Insert: {
          acao: string
          alvo_email?: string | null
          alvo_id?: string | null
          alvo_tipo?: string
          ator_email?: string
          ator_id?: string | null
          created_at?: string
          detalhes?: Json
          id?: string
          motivo?: string
        }
        Update: {
          acao?: string
          alvo_email?: string | null
          alvo_id?: string | null
          alvo_tipo?: string
          ator_email?: string
          ator_id?: string | null
          created_at?: string
          detalhes?: Json
          id?: string
          motivo?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          aprendizado: string
          atribuicao_id: string | null
          clareza: number | null
          cliente_id: string
          condicoes_continuar: boolean
          conteudo_id: string | null
          created_at: string
          emocao: string
          id: string
          intencao: string
          intensidade: number
          local_corpo: string
          momento: Database["public"]["Enums"]["momento_checkin"]
          precisa_contato: boolean
          presenca: boolean | null
        }
        Insert: {
          aprendizado?: string
          atribuicao_id?: string | null
          clareza?: number | null
          cliente_id: string
          condicoes_continuar?: boolean
          conteudo_id?: string | null
          created_at?: string
          emocao?: string
          id?: string
          intencao?: string
          intensidade?: number
          local_corpo?: string
          momento: Database["public"]["Enums"]["momento_checkin"]
          precisa_contato?: boolean
          presenca?: boolean | null
        }
        Update: {
          aprendizado?: string
          atribuicao_id?: string | null
          clareza?: number | null
          cliente_id?: string
          condicoes_continuar?: boolean
          conteudo_id?: string | null
          created_at?: string
          emocao?: string
          id?: string
          intencao?: string
          intensidade?: number
          local_corpo?: string
          momento?: Database["public"]["Enums"]["momento_checkin"]
          precisa_contato?: boolean
          presenca?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_atribuicao_id_fkey"
            columns: ["atribuicao_id"]
            isOneToOne: false
            referencedRelation: "atribuicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_conteudo_id_fkey"
            columns: ["conteudo_id"]
            isOneToOne: false
            referencedRelation: "conteudos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_acesso: {
        Row: {
          created_at: string
          modo: Database["public"]["Enums"]["modo_uso"]
          modo_desde: string
          observacoes: string
          status: Database["public"]["Enums"]["acesso_status"]
          telefone: string
          terapeuta_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          modo?: Database["public"]["Enums"]["modo_uso"]
          modo_desde?: string
          observacoes?: string
          status?: Database["public"]["Enums"]["acesso_status"]
          telefone?: string
          terapeuta_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          modo?: Database["public"]["Enums"]["modo_uso"]
          modo_desde?: string
          observacoes?: string
          status?: Database["public"]["Enums"]["acesso_status"]
          telefone?: string
          terapeuta_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clientes_pacotes: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          pacote_id: string
          status_pagamento: Database["public"]["Enums"]["pagamento_status"]
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          pacote_id: string
          status_pagamento?: Database["public"]["Enums"]["pagamento_status"]
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          pacote_id?: string
          status_pagamento?: Database["public"]["Enums"]["pagamento_status"]
        }
        Relationships: [
          {
            foreignKeyName: "clientes_pacotes_pacote_id_fkey"
            columns: ["pacote_id"]
            isOneToOne: false
            referencedRelation: "pacotes"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_terapeuta: {
        Row: {
          contatos_emergencia: Json
          created_at: string
          prazo_resposta_horas: number
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          contatos_emergencia?: Json
          created_at?: string
          prazo_resposta_horas?: number
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          contatos_emergencia?: Json
          created_at?: string
          prazo_resposta_horas?: number
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      consentimentos: {
        Row: {
          aceito_em: string
          id: string
          tipo: string
          user_id: string
          versao: string
        }
        Insert: {
          aceito_em?: string
          id?: string
          tipo: string
          user_id: string
          versao?: string
        }
        Update: {
          aceito_em?: string
          id?: string
          tipo?: string
          user_id?: string
          versao?: string
        }
        Relationships: []
      }
      conteudos: {
        Row: {
          corpo_texto: string | null
          created_at: string
          criterios_interrupcao: string
          descricao: string
          duracao_segundos: number
          eixo_id: string
          id: string
          legendas_path: string | null
          local_recomendado: string
          materiais: string
          obrigatoria: boolean
          ordem: number
          permite_repetir: boolean
          sensibilidades: string
          storage_path: string | null
          thumbnail_path: string | null
          tipo: Database["public"]["Enums"]["conteudo_tipo"]
          tipo_etapa: Database["public"]["Enums"]["etapa_tipo"] | null
          titulo: string
          transcricao: string
          trilha_id: string | null
        }
        Insert: {
          corpo_texto?: string | null
          created_at?: string
          criterios_interrupcao?: string
          descricao?: string
          duracao_segundos?: number
          eixo_id: string
          id?: string
          legendas_path?: string | null
          local_recomendado?: string
          materiais?: string
          obrigatoria?: boolean
          ordem?: number
          permite_repetir?: boolean
          sensibilidades?: string
          storage_path?: string | null
          thumbnail_path?: string | null
          tipo?: Database["public"]["Enums"]["conteudo_tipo"]
          tipo_etapa?: Database["public"]["Enums"]["etapa_tipo"] | null
          titulo: string
          transcricao?: string
          trilha_id?: string | null
        }
        Update: {
          corpo_texto?: string | null
          created_at?: string
          criterios_interrupcao?: string
          descricao?: string
          duracao_segundos?: number
          eixo_id?: string
          id?: string
          legendas_path?: string | null
          local_recomendado?: string
          materiais?: string
          obrigatoria?: boolean
          ordem?: number
          permite_repetir?: boolean
          sensibilidades?: string
          storage_path?: string | null
          thumbnail_path?: string | null
          tipo?: Database["public"]["Enums"]["conteudo_tipo"]
          tipo_etapa?: Database["public"]["Enums"]["etapa_tipo"] | null
          titulo?: string
          transcricao?: string
          trilha_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conteudos_eixo_id_fkey"
            columns: ["eixo_id"]
            isOneToOne: false
            referencedRelation: "eixos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conteudos_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      convites_clientes: {
        Row: {
          aceito_em: string | null
          cliente_id: string | null
          created_at: string
          email: string
          expira_em: string
          id: string
          nome: string
          status: string
          telefone: string
          terapeuta_id: string | null
          token: string
        }
        Insert: {
          aceito_em?: string | null
          cliente_id?: string | null
          created_at?: string
          email: string
          expira_em?: string
          id?: string
          nome?: string
          status?: string
          telefone?: string
          terapeuta_id?: string | null
          token?: string
        }
        Update: {
          aceito_em?: string | null
          cliente_id?: string | null
          created_at?: string
          email?: string
          expira_em?: string
          id?: string
          nome?: string
          status?: string
          telefone?: string
          terapeuta_id?: string | null
          token?: string
        }
        Relationships: []
      }
      convites_equipe: {
        Row: {
          aceito_em: string | null
          created_at: string
          criado_por: string | null
          email: string
          expira_em: string
          id: string
          permissoes: string[]
          status: string
          token: string
        }
        Insert: {
          aceito_em?: string | null
          created_at?: string
          criado_por?: string | null
          email: string
          expira_em?: string
          id?: string
          permissoes?: string[]
          status?: string
          token?: string
        }
        Update: {
          aceito_em?: string | null
          created_at?: string
          criado_por?: string | null
          email?: string
          expira_em?: string
          id?: string
          permissoes?: string[]
          status?: string
          token?: string
        }
        Relationships: []
      }
      diario: {
        Row: {
          atribuicao_id: string | null
          cliente_id: string
          compartilhado_em: string | null
          compartilhamento_revogado_em: string | null
          conteudo_id: string | null
          created_at: string
          id: string
          texto: string
          visibilidade: Database["public"]["Enums"]["diario_visibilidade"]
        }
        Insert: {
          atribuicao_id?: string | null
          cliente_id: string
          compartilhado_em?: string | null
          compartilhamento_revogado_em?: string | null
          conteudo_id?: string | null
          created_at?: string
          id?: string
          texto: string
          visibilidade?: Database["public"]["Enums"]["diario_visibilidade"]
        }
        Update: {
          atribuicao_id?: string | null
          cliente_id?: string
          compartilhado_em?: string | null
          compartilhamento_revogado_em?: string | null
          conteudo_id?: string | null
          created_at?: string
          id?: string
          texto?: string
          visibilidade?: Database["public"]["Enums"]["diario_visibilidade"]
        }
        Relationships: [
          {
            foreignKeyName: "diario_atribuicao_id_fkey"
            columns: ["atribuicao_id"]
            isOneToOne: false
            referencedRelation: "atribuicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diario_conteudo_id_fkey"
            columns: ["conteudo_id"]
            isOneToOne: false
            referencedRelation: "conteudos"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositivos_push: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: []
      }
      eixos: {
        Row: {
          created_at: string
          descricao: string
          icone: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          created_at?: string
          descricao?: string
          icone?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          created_at?: string
          descricao?: string
          icone?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      equipe_admins: {
        Row: {
          created_at: string
          criado_por: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          user_id?: string
        }
        Relationships: []
      }
      equipe_permissoes: {
        Row: {
          created_at: string
          id: string
          permissao: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permissao: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permissao?: string
          user_id?: string
        }
        Relationships: []
      }
      lembretes_enviados: {
        Row: {
          canal: string
          chave_dedupe: string
          created_at: string
          id: string
          status: string
          tipo: string
          user_id: string
        }
        Insert: {
          canal?: string
          chave_dedupe: string
          created_at?: string
          id?: string
          status?: string
          tipo: string
          user_id: string
        }
        Update: {
          canal?: string
          chave_dedupe?: string
          created_at?: string
          id?: string
          status?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      liberacoes: {
        Row: {
          cliente_id: string
          conteudo_id: string | null
          eixo_id: string | null
          id: string
          liberado_em: string
          liberar_em: string | null
          status: Database["public"]["Enums"]["liberacao_status"]
        }
        Insert: {
          cliente_id: string
          conteudo_id?: string | null
          eixo_id?: string | null
          id?: string
          liberado_em?: string
          liberar_em?: string | null
          status?: Database["public"]["Enums"]["liberacao_status"]
        }
        Update: {
          cliente_id?: string
          conteudo_id?: string | null
          eixo_id?: string | null
          id?: string
          liberado_em?: string
          liberar_em?: string | null
          status?: Database["public"]["Enums"]["liberacao_status"]
        }
        Relationships: [
          {
            foreignKeyName: "liberacoes_conteudo_id_fkey"
            columns: ["conteudo_id"]
            isOneToOne: false
            referencedRelation: "conteudos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liberacoes_eixo_id_fkey"
            columns: ["eixo_id"]
            isOneToOne: false
            referencedRelation: "eixos"
            referencedColumns: ["id"]
          },
        ]
      }
      limites_uso: {
        Row: {
          acao: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          acao: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          titulo: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          titulo: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          titulo?: string
        }
        Relationships: []
      }
      pacotes: {
        Row: {
          created_at: string
          descricao: string
          eixos_incluidos: string[]
          id: string
          nome: string
          preco_centavos: number
          tipo_cobranca: Database["public"]["Enums"]["tipo_cobranca"]
          trilhas_incluidas: string[]
        }
        Insert: {
          created_at?: string
          descricao?: string
          eixos_incluidos?: string[]
          id?: string
          nome: string
          preco_centavos?: number
          tipo_cobranca?: Database["public"]["Enums"]["tipo_cobranca"]
          trilhas_incluidas?: string[]
        }
        Update: {
          created_at?: string
          descricao?: string
          eixos_incluidos?: string[]
          id?: string
          nome?: string
          preco_centavos?: number
          tipo_cobranca?: Database["public"]["Enums"]["tipo_cobranca"]
          trilhas_incluidas?: string[]
        }
        Relationships: []
      }
      preferencias_lembretes: {
        Row: {
          ativo: boolean
          canal_email: boolean
          canal_push: boolean
          definido_por: string
          dia_semana: number
          dias_inatividade: number
          fuso: string
          hora_local: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          canal_email?: boolean
          canal_push?: boolean
          definido_por?: string
          dia_semana?: number
          dias_inatividade?: number
          fuso?: string
          hora_local?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          canal_email?: boolean
          canal_push?: boolean
          definido_por?: string
          dia_semana?: number
          dias_inatividade?: number
          fuso?: string
          hora_local?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          meta_semanal: number
          nome: string
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          meta_semanal?: number
          nome?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          meta_semanal?: number
          nome?: string
        }
        Relationships: []
      }
      progresso: {
        Row: {
          cliente_id: string
          concluido_em: string | null
          conteudo_id: string
          estava_tocando: boolean
          id: string
          posicao_atualizada_em: string | null
          posicao_segundos: number
          status: Database["public"]["Enums"]["progresso_status"]
          updated_at: string
        }
        Insert: {
          cliente_id: string
          concluido_em?: string | null
          conteudo_id: string
          estava_tocando?: boolean
          id?: string
          posicao_atualizada_em?: string | null
          posicao_segundos?: number
          status?: Database["public"]["Enums"]["progresso_status"]
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          concluido_em?: string | null
          conteudo_id?: string
          estava_tocando?: boolean
          id?: string
          posicao_atualizada_em?: string | null
          posicao_segundos?: number
          status?: Database["public"]["Enums"]["progresso_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progresso_conteudo_id_fkey"
            columns: ["conteudo_id"]
            isOneToOne: false
            referencedRelation: "conteudos"
            referencedColumns: ["id"]
          },
        ]
      }
      revisoes: {
        Row: {
          acoes: string
          aprendizados: string
          atribuicao_id: string
          autonomia: number | null
          clareza: number | null
          cliente_id: string
          created_at: string
          devolutiva: string
          estado_atual: string
          estado_inicial: string
          id: string
          precisa_acompanhamento: string
        }
        Insert: {
          acoes?: string
          aprendizados?: string
          atribuicao_id: string
          autonomia?: number | null
          clareza?: number | null
          cliente_id: string
          created_at?: string
          devolutiva?: string
          estado_atual?: string
          estado_inicial?: string
          id?: string
          precisa_acompanhamento?: string
        }
        Update: {
          acoes?: string
          aprendizados?: string
          atribuicao_id?: string
          autonomia?: number | null
          clareza?: number | null
          cliente_id?: string
          created_at?: string
          devolutiva?: string
          estado_atual?: string
          estado_inicial?: string
          id?: string
          precisa_acompanhamento?: string
        }
        Relationships: [
          {
            foreignKeyName: "revisoes_atribuicao_id_fkey"
            columns: ["atribuicao_id"]
            isOneToOne: false
            referencedRelation: "atribuicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_acompanhamento: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          mensagem: string
          respondido_em: string | null
          respondido_por: string | null
          resposta: string
          status: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          mensagem?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          mensagem?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      solicitacoes_apoio: {
        Row: {
          atribuicao_id: string | null
          cliente_id: string
          created_at: string
          id: string
          intensidade: number | null
          mensagem: string
          origem: string
          respondido_em: string | null
          respondido_por: string | null
          resposta: string
          status: Database["public"]["Enums"]["apoio_status"]
        }
        Insert: {
          atribuicao_id?: string | null
          cliente_id: string
          created_at?: string
          id?: string
          intensidade?: number | null
          mensagem?: string
          origem?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string
          status?: Database["public"]["Enums"]["apoio_status"]
        }
        Update: {
          atribuicao_id?: string | null
          cliente_id?: string
          created_at?: string
          id?: string
          intensidade?: number | null
          mensagem?: string
          origem?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string
          status?: Database["public"]["Enums"]["apoio_status"]
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_apoio_atribuicao_id_fkey"
            columns: ["atribuicao_id"]
            isOneToOne: false
            referencedRelation: "atribuicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      trilhas: {
        Row: {
          alertas: string
          autor_id: string | null
          created_at: string
          eixo_id: string
          id: string
          modos: Database["public"]["Enums"]["modo_uso"][]
          nivel: Database["public"]["Enums"]["nivel_profundidade"]
          nome: string
          objetivo: string
          ordem: number
          orientacoes_pausa: string
          prerequisitos: string
          resumo: string
          revisor_id: string | null
          status: Database["public"]["Enums"]["trilha_status"]
          updated_at: string
          versao: number
        }
        Insert: {
          alertas?: string
          autor_id?: string | null
          created_at?: string
          eixo_id: string
          id?: string
          modos?: Database["public"]["Enums"]["modo_uso"][]
          nivel?: Database["public"]["Enums"]["nivel_profundidade"]
          nome: string
          objetivo?: string
          ordem?: number
          orientacoes_pausa?: string
          prerequisitos?: string
          resumo?: string
          revisor_id?: string | null
          status?: Database["public"]["Enums"]["trilha_status"]
          updated_at?: string
          versao?: number
        }
        Update: {
          alertas?: string
          autor_id?: string | null
          created_at?: string
          eixo_id?: string
          id?: string
          modos?: Database["public"]["Enums"]["modo_uso"][]
          nivel?: Database["public"]["Enums"]["nivel_profundidade"]
          nome?: string
          objetivo?: string
          ordem?: number
          orientacoes_pausa?: string
          prerequisitos?: string
          resumo?: string
          revisor_id?: string | null
          status?: Database["public"]["Enums"]["trilha_status"]
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "trilhas_eixo_id_fkey"
            columns: ["eixo_id"]
            isOneToOne: false
            referencedRelation: "eixos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceitar_convite_equipe: { Args: { _token: string }; Returns: string }
      acompanha_cliente: { Args: { _cliente: string }; Returns: boolean }
      consumir_limite: {
        Args: {
          _acao: string
          _janela_segundos: number
          _limite: number
          _user_id: string
        }
        Returns: Json
      }
      conteudo_liberado: {
        Args: { _cliente_id: string; _conteudo_id: string; _eixo_id: string }
        Returns: boolean
      }
      existe_terapeuta: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_terapeuta: { Args: never; Returns: boolean }
      minha_atribuicao: { Args: { _atribuicao: string }; Returns: boolean }
      pode: { Args: { _permissao: string }; Returns: boolean }
      pode_administrar: { Args: never; Returns: boolean }
      tem_permissao: {
        Args: { _permissao: string; _user_id: string }
        Returns: boolean
      }
      trilha_atribuida: { Args: { _trilha: string }; Returns: boolean }
      trilha_liberada_autoguiada: {
        Args: { _cliente_id: string; _trilha: string }
        Returns: boolean
      }
    }
    Enums: {
      acesso_status: "ativo" | "pausado" | "encerrado"
      apoio_status: "aberta" | "em_atendimento" | "respondida" | "encerrada"
      app_role: "terapeuta" | "cliente"
      atribuicao_status: "ativa" | "pausada" | "concluida" | "encerrada"
      conteudo_tipo: "video" | "audio" | "exercicio" | "texto" | "tarefa"
      diario_visibilidade: "somente_eu" | "compartilhado"
      etapa_tipo:
        | "orientacao"
        | "preparacao"
        | "checkin_inicial"
        | "compreensao"
        | "aterramento"
        | "meditacao"
        | "movimento"
        | "integracao"
        | "acao"
        | "checkout"
      liberacao_status: "bloqueado" | "liberado"
      modo_uso: "acompanhado" | "autoguiado"
      momento_checkin: "inicial" | "final"
      nivel_profundidade: "leve" | "intermediario" | "profundo"
      pagamento_status: "pendente" | "pago" | "cancelado"
      progresso_status: "nao_iniciado" | "em_andamento" | "concluido"
      tipo_cobranca: "pagamento_unico" | "assinatura"
      trilha_status: "rascunho" | "em_revisao" | "publicado" | "arquivado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acesso_status: ["ativo", "pausado", "encerrado"],
      apoio_status: ["aberta", "em_atendimento", "respondida", "encerrada"],
      app_role: ["terapeuta", "cliente"],
      atribuicao_status: ["ativa", "pausada", "concluida", "encerrada"],
      conteudo_tipo: ["video", "audio", "exercicio", "texto", "tarefa"],
      diario_visibilidade: ["somente_eu", "compartilhado"],
      etapa_tipo: [
        "orientacao",
        "preparacao",
        "checkin_inicial",
        "compreensao",
        "aterramento",
        "meditacao",
        "movimento",
        "integracao",
        "acao",
        "checkout",
      ],
      liberacao_status: ["bloqueado", "liberado"],
      modo_uso: ["acompanhado", "autoguiado"],
      momento_checkin: ["inicial", "final"],
      nivel_profundidade: ["leve", "intermediario", "profundo"],
      pagamento_status: ["pendente", "pago", "cancelado"],
      progresso_status: ["nao_iniciado", "em_andamento", "concluido"],
      tipo_cobranca: ["pagamento_unico", "assinatura"],
      trilha_status: ["rascunho", "em_revisao", "publicado", "arquivado"],
    },
  },
} as const
