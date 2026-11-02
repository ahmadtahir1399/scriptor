/**
 * ============================================================================
 * GENERATED FILE — DO NOT EDIT BY HAND.
 * ============================================================================
 *
 * Regenerate with:
 *
 *     npm run db:types
 *
 * which runs `supabase gen types typescript --linked > lib/db/types.generated.ts`.
 *
 * ---------------------------------------------------------------------------
 * PROVENANCE WARNING
 * ---------------------------------------------------------------------------
 * This particular copy was written by hand to match the migrations in
 * `supabase/migrations/` exactly, because the Supabase CLI could not be
 * installed on the authoring machine (see the note in the P1 handover). It is
 * believed correct, but it has NOT been round-tripped through the generator.
 *
 * Run `npm run db:types` as soon as the toolchain works and commit whatever it
 * produces. Treat the generator's output as authoritative over this file if the
 * two ever disagree.
 * ---------------------------------------------------------------------------
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // ---------------------------------------------------------------- 03
      institutions: {
        Row: {
          id: string;
          name: string;
          domain: string | null;
          country: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          domain?: string | null;
          country?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          domain?: string | null;
          country?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          locale: Database["public"]["Enums"]["app_locale"];
          institution_id: string | null;
          is_anonymized: boolean;
          anonymized_at: string | null;
          apply_custom_checks_by_default: boolean;
          default_auto_delete: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          locale?: Database["public"]["Enums"]["app_locale"];
          institution_id?: string | null;
          is_anonymized?: boolean;
          anonymized_at?: string | null;
          apply_custom_checks_by_default?: boolean;
          default_auto_delete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          locale?: Database["public"]["Enums"]["app_locale"];
          institution_id?: string | null;
          is_anonymized?: boolean;
          anonymized_at?: string | null;
          apply_custom_checks_by_default?: boolean;
          default_auto_delete?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_institution_id_fkey";
            columns: ["institution_id"];
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };

      role_definitions: {
        Row: {
          role: Database["public"]["Enums"]["app_role"];
          description: string;
          created_at: string;
        };
        Insert: {
          role: Database["public"]["Enums"]["app_role"];
          description: string;
          created_at?: string;
        };
        Update: {
          role?: Database["public"]["Enums"]["app_role"];
          description?: string;
          created_at?: string;
        };
        Relationships: [];
      };

      permission_definitions: {
        Row: {
          permission: Database["public"]["Enums"]["app_permission"];
          description: string;
          created_at: string;
        };
        Insert: {
          permission: Database["public"]["Enums"]["app_permission"];
          description: string;
          created_at?: string;
        };
        Update: {
          permission?: Database["public"]["Enums"]["app_permission"];
          description?: string;
          created_at?: string;
        };
        Relationships: [];
      };

      role_permissions: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          permission: Database["public"]["Enums"]["app_permission"];
          created_at: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          permission: Database["public"]["Enums"]["app_permission"];
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          permission?: Database["public"]["Enums"]["app_permission"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_fkey";
            columns: ["role"];
            referencedRelation: "role_definitions";
            referencedColumns: ["role"];
          },
          {
            foreignKeyName: "role_permissions_permission_fkey";
            columns: ["permission"];
            referencedRelation: "permission_definitions";
            referencedColumns: ["permission"];
          },
        ];
      };

      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          granted_by: string | null;
          granted_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          granted_by?: string | null;
          granted_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          granted_by?: string | null;
          granted_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_role_fkey";
            columns: ["role"];
            referencedRelation: "role_definitions";
            referencedColumns: ["role"];
          },
        ];
      };

      // ---------------------------------------------------------------- 04
      document_types: {
        Row: {
          id: string;
          code: string;
          name_en: string;
          name_de: string;
          max_chars: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name_en: string;
          name_de: string;
          max_chars: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name_en?: string;
          name_de?: string;
          max_chars?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      checks: {
        Row: {
          id: string;
          code: string;
          name_en: string;
          name_de: string;
          description_en: string;
          description_de: string;
          processing_mode: Database["public"]["Enums"]["processing_mode"];
          page_scope: Database["public"]["Enums"]["page_type"][];
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name_en: string;
          name_de: string;
          description_en: string;
          description_de: string;
          processing_mode: Database["public"]["Enums"]["processing_mode"];
          page_scope?: Database["public"]["Enums"]["page_type"][];
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name_en?: string;
          name_de?: string;
          description_en?: string;
          description_de?: string;
          processing_mode?: Database["public"]["Enums"]["processing_mode"];
          page_scope?: Database["public"]["Enums"]["page_type"][];
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      check_versions: {
        Row: {
          id: string;
          check_id: string;
          version: number;
          analysis_prompt: string;
          feedback_prompt: string;
          test_prompt: string | null;
          model: string;
          temperature: number;
          locale: Database["public"]["Enums"]["app_locale"];
          is_active: boolean;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          check_id: string;
          version: number;
          analysis_prompt: string;
          feedback_prompt: string;
          test_prompt?: string | null;
          model: string;
          temperature?: number;
          locale?: Database["public"]["Enums"]["app_locale"];
          is_active?: boolean;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          check_id?: string;
          version?: number;
          analysis_prompt?: string;
          feedback_prompt?: string;
          test_prompt?: string | null;
          model?: string;
          temperature?: number;
          locale?: Database["public"]["Enums"]["app_locale"];
          is_active?: boolean;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "check_versions_check_id_fkey";
            columns: ["check_id"];
            referencedRelation: "checks";
            referencedColumns: ["id"];
          },
        ];
      };

      document_type_checks: {
        Row: {
          id: string;
          document_type_id: string;
          check_id: string;
          is_default: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_type_id: string;
          check_id: string;
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_type_id?: string;
          check_id?: string;
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_type_checks_document_type_id_fkey";
            columns: ["document_type_id"];
            referencedRelation: "document_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_type_checks_check_id_fkey";
            columns: ["check_id"];
            referencedRelation: "checks";
            referencedColumns: ["id"];
          },
        ];
      };

      check_ab_tests: {
        Row: {
          id: string;
          check_id: string;
          control_version_id: string;
          variant_version_id: string;
          traffic_percent: number;
          is_active: boolean;
          started_at: string | null;
          ended_at: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          check_id: string;
          control_version_id: string;
          variant_version_id: string;
          traffic_percent?: number;
          is_active?: boolean;
          started_at?: string | null;
          ended_at?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          check_id?: string;
          control_version_id?: string;
          variant_version_id?: string;
          traffic_percent?: number;
          is_active?: boolean;
          started_at?: string | null;
          ended_at?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "check_ab_tests_check_id_fkey";
            columns: ["check_id"];
            referencedRelation: "checks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "check_ab_tests_control_version_id_fkey";
            columns: ["control_version_id"];
            referencedRelation: "check_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "check_ab_tests_variant_version_id_fkey";
            columns: ["variant_version_id"];
            referencedRelation: "check_versions";
            referencedColumns: ["id"];
          },
        ];
      };

      // ---------------------------------------------------------------- 05
      papers: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          current_upload_id: string | null;
          current_analysis_id: string | null;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          current_upload_id?: string | null;
          current_analysis_id?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          current_upload_id?: string | null;
          current_analysis_id?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "papers_current_upload_id_fkey";
            columns: ["current_upload_id"];
            referencedRelation: "paper_uploads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "papers_current_analysis_id_fkey";
            columns: ["current_analysis_id"];
            referencedRelation: "paper_analyses";
            referencedColumns: ["id"];
          },
        ];
      };

      paper_uploads: {
        Row: {
          id: string;
          paper_id: string;
          user_id: string;
          file_path: string;
          file_name: string;
          file_format: Database["public"]["Enums"]["file_format"];
          file_size_bytes: number;
          checksum_sha256: string | null;
          title: string | null;
          author: string | null;
          page_count: number | null;
          word_count: number | null;
          char_count: number | null;
          locale: Database["public"]["Enums"]["app_locale"] | null;
          spelling: Database["public"]["Enums"]["spelling_variant"] | null;
          citation_style: Database["public"]["Enums"]["citation_style"] | null;
          document_type_code: string | null;
          is_compatible: boolean | null;
          incompatibility_reason: string | null;
          auto_delete: boolean;
          share_data: boolean;
          send_email_results: boolean;
          selected_check_ids: string[];
          use_custom_requirements: boolean;
          uploaded_at: string;
          parsed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_id: string;
          user_id?: string;
          file_path: string;
          file_name: string;
          file_format: Database["public"]["Enums"]["file_format"];
          file_size_bytes: number;
          checksum_sha256?: string | null;
          title?: string | null;
          author?: string | null;
          page_count?: number | null;
          word_count?: number | null;
          char_count?: number | null;
          locale?: Database["public"]["Enums"]["app_locale"] | null;
          spelling?: Database["public"]["Enums"]["spelling_variant"] | null;
          citation_style?: Database["public"]["Enums"]["citation_style"] | null;
          document_type_code?: string | null;
          is_compatible?: boolean | null;
          incompatibility_reason?: string | null;
          auto_delete?: boolean;
          share_data?: boolean;
          send_email_results?: boolean;
          selected_check_ids?: string[];
          use_custom_requirements?: boolean;
          uploaded_at?: string;
          parsed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_id?: string;
          user_id?: string;
          file_path?: string;
          file_name?: string;
          file_format?: Database["public"]["Enums"]["file_format"];
          file_size_bytes?: number;
          checksum_sha256?: string | null;
          title?: string | null;
          author?: string | null;
          page_count?: number | null;
          word_count?: number | null;
          char_count?: number | null;
          locale?: Database["public"]["Enums"]["app_locale"] | null;
          spelling?: Database["public"]["Enums"]["spelling_variant"] | null;
          citation_style?: Database["public"]["Enums"]["citation_style"] | null;
          document_type_code?: string | null;
          is_compatible?: boolean | null;
          incompatibility_reason?: string | null;
          auto_delete?: boolean;
          share_data?: boolean;
          send_email_results?: boolean;
          selected_check_ids?: string[];
          use_custom_requirements?: boolean;
          uploaded_at?: string;
          parsed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paper_uploads_paper_id_fkey";
            columns: ["paper_id"];
            referencedRelation: "papers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paper_uploads_document_type_code_fkey";
            columns: ["document_type_code"];
            referencedRelation: "document_types";
            referencedColumns: ["code"];
          },
        ];
      };

      upload_entitlements: {
        Row: {
          id: string;
          paper_upload_id: string;
          user_id: string;
          allow_defense: boolean;
          allow_todo: boolean;
          allow_page_feedback: boolean;
          allow_ai_detection: boolean;
          allow_reference_health: boolean;
          max_checks: number;
          tier: string;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          paper_upload_id: string;
          user_id?: string;
          allow_defense?: boolean;
          allow_todo?: boolean;
          allow_page_feedback?: boolean;
          allow_ai_detection?: boolean;
          allow_reference_health?: boolean;
          max_checks?: number;
          tier?: string;
          source?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "upload_entitlements_paper_upload_id_fkey";
            columns: ["paper_upload_id"];
            referencedRelation: "paper_uploads";
            referencedColumns: ["id"];
          },
        ];
      };

      // ---------------------------------------------------------------- 06
      paper_pages: {
        Row: {
          id: string;
          paper_upload_id: string;
          user_id: string;
          page_number: number;
          page_content: string;
          page_type: Database["public"]["Enums"]["page_type"];
          char_offset_start: number;
          char_offset_end: number;
          word_count: number;
          page_width: number;
          page_height: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_upload_id: string;
          user_id?: string;
          page_number: number;
          page_content?: string;
          page_type?: Database["public"]["Enums"]["page_type"];
          char_offset_start?: number;
          char_offset_end?: number;
          word_count?: number;
          page_width?: number;
          page_height?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_upload_id?: string;
          user_id?: string;
          page_number?: number;
          page_content?: string;
          page_type?: Database["public"]["Enums"]["page_type"];
          char_offset_start?: number;
          char_offset_end?: number;
          word_count?: number;
          page_width?: number;
          page_height?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paper_pages_paper_upload_id_fkey";
            columns: ["paper_upload_id"];
            referencedRelation: "paper_uploads";
            referencedColumns: ["id"];
          },
        ];
      };

      words: {
        Row: {
          id: number;
          paper_upload_id: string;
          user_id: string;
          text: string;
          page_number: number;
          word_index: number;
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          width: number;
          height: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          paper_upload_id: string;
          user_id?: string;
          text: string;
          page_number: number;
          word_index: number;
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          width: number;
          height: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          paper_upload_id?: string;
          user_id?: string;
          text?: string;
          page_number?: number;
          word_index?: number;
          x1?: number;
          y1?: number;
          x2?: number;
          y2?: number;
          width?: number;
          height?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "words_paper_upload_id_fkey";
            columns: ["paper_upload_id"];
            referencedRelation: "paper_uploads";
            referencedColumns: ["id"];
          },
        ];
      };

      // ---------------------------------------------------------------- 07
      paper_analyses: {
        Row: {
          id: string;
          paper_upload_id: string;
          paper_id: string;
          user_id: string;
          status: Database["public"]["Enums"]["analysis_status"];
          plagiarism_status: Database["public"]["Enums"]["job_status"];
          todo_status: Database["public"]["Enums"]["job_status"];
          defense_status: Database["public"]["Enums"]["job_status"];
          reference_health_status: Database["public"]["Enums"]["job_status"];
          ai_detection_status: Database["public"]["Enums"]["job_status"];
          overall_score: number | null;
          ai_strong_percent: number | null;
          ai_likely_percent: number | null;
          estimated_cost_usd: number | null;
          error_message: string | null;
          error_reason: string | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_upload_id: string;
          paper_id: string;
          user_id?: string;
          status?: Database["public"]["Enums"]["analysis_status"];
          plagiarism_status?: Database["public"]["Enums"]["job_status"];
          todo_status?: Database["public"]["Enums"]["job_status"];
          defense_status?: Database["public"]["Enums"]["job_status"];
          reference_health_status?: Database["public"]["Enums"]["job_status"];
          ai_detection_status?: Database["public"]["Enums"]["job_status"];
          overall_score?: number | null;
          ai_strong_percent?: number | null;
          ai_likely_percent?: number | null;
          estimated_cost_usd?: number | null;
          error_message?: string | null;
          error_reason?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_upload_id?: string;
          paper_id?: string;
          user_id?: string;
          status?: Database["public"]["Enums"]["analysis_status"];
          plagiarism_status?: Database["public"]["Enums"]["job_status"];
          todo_status?: Database["public"]["Enums"]["job_status"];
          defense_status?: Database["public"]["Enums"]["job_status"];
          reference_health_status?: Database["public"]["Enums"]["job_status"];
          ai_detection_status?: Database["public"]["Enums"]["job_status"];
          overall_score?: number | null;
          ai_strong_percent?: number | null;
          ai_likely_percent?: number | null;
          estimated_cost_usd?: number | null;
          error_message?: string | null;
          error_reason?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paper_analyses_paper_upload_id_fkey";
            columns: ["paper_upload_id"];
            referencedRelation: "paper_uploads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paper_analyses_paper_id_fkey";
            columns: ["paper_id"];
            referencedRelation: "papers";
            referencedColumns: ["id"];
          },
        ];
      };

      check_results: {
        Row: {
          id: string;
          paper_analysis_id: string;
          check_id: string;
          check_version_id: string;
          user_id: string;
          status: Database["public"]["Enums"]["job_status"];
          feedback: string | null;
          feedback_structured: Json;
          score: number | null;
          rating: number | null;
          is_helpful: boolean | null;
          user_comment: string | null;
          hidden_because_ab_test: boolean;
          ab_test_id: string | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_analysis_id: string;
          check_id: string;
          check_version_id: string;
          user_id?: string;
          status?: Database["public"]["Enums"]["job_status"];
          feedback?: string | null;
          feedback_structured?: Json;
          score?: number | null;
          rating?: number | null;
          is_helpful?: boolean | null;
          user_comment?: string | null;
          hidden_because_ab_test?: boolean;
          ab_test_id?: string | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_analysis_id?: string;
          check_id?: string;
          check_version_id?: string;
          user_id?: string;
          status?: Database["public"]["Enums"]["job_status"];
          feedback?: string | null;
          feedback_structured?: Json;
          score?: number | null;
          rating?: number | null;
          is_helpful?: boolean | null;
          user_comment?: string | null;
          hidden_because_ab_test?: boolean;
          ab_test_id?: string | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "check_results_paper_analysis_id_fkey";
            columns: ["paper_analysis_id"];
            referencedRelation: "paper_analyses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "check_results_check_id_fkey";
            columns: ["check_id"];
            referencedRelation: "checks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "check_results_check_version_id_fkey";
            columns: ["check_version_id"];
            referencedRelation: "check_versions";
            referencedColumns: ["id"];
          },
        ];
      };

      findings: {
        Row: {
          id: string;
          check_result_id: string;
          paper_analysis_id: string;
          user_id: string;
          quote: string;
          correction: string | null;
          title: string;
          description: string;
          page_number: number | null;
          char_start: number | null;
          char_end: number | null;
          word_index_start: number | null;
          word_index_end: number | null;
          type: Database["public"]["Enums"]["finding_type"];
          severity: Database["public"]["Enums"]["finding_severity"];
          is_resolved: boolean;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          check_result_id: string;
          paper_analysis_id: string;
          user_id?: string;
          quote: string;
          correction?: string | null;
          title: string;
          description?: string;
          page_number?: number | null;
          char_start?: number | null;
          char_end?: number | null;
          word_index_start?: number | null;
          word_index_end?: number | null;
          type: Database["public"]["Enums"]["finding_type"];
          severity?: Database["public"]["Enums"]["finding_severity"];
          is_resolved?: boolean;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          check_result_id?: string;
          paper_analysis_id?: string;
          user_id?: string;
          quote?: string;
          correction?: string | null;
          title?: string;
          description?: string;
          page_number?: number | null;
          char_start?: number | null;
          char_end?: number | null;
          word_index_start?: number | null;
          word_index_end?: number | null;
          type?: Database["public"]["Enums"]["finding_type"];
          severity?: Database["public"]["Enums"]["finding_severity"];
          is_resolved?: boolean;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "findings_check_result_id_fkey";
            columns: ["check_result_id"];
            referencedRelation: "check_results";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "findings_paper_analysis_id_fkey";
            columns: ["paper_analysis_id"];
            referencedRelation: "paper_analyses";
            referencedColumns: ["id"];
          },
        ];
      };

      // ---------------------------------------------------------------- 08
      in_text_references: {
        Row: {
          id: string;
          paper_analysis_id: string;
          paper_upload_id: string;
          user_id: string;
          raw_text: string;
          authors: string[];
          year: string | null;
          locator: string | null;
          page_number: number | null;
          char_start: number | null;
          char_end: number | null;
          word_index_start: number | null;
          word_index_end: number | null;
          is_matched: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_analysis_id: string;
          paper_upload_id: string;
          user_id?: string;
          raw_text: string;
          authors?: string[];
          year?: string | null;
          locator?: string | null;
          page_number?: number | null;
          char_start?: number | null;
          char_end?: number | null;
          word_index_start?: number | null;
          word_index_end?: number | null;
          is_matched?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_analysis_id?: string;
          paper_upload_id?: string;
          user_id?: string;
          raw_text?: string;
          authors?: string[];
          year?: string | null;
          locator?: string | null;
          page_number?: number | null;
          char_start?: number | null;
          char_end?: number | null;
          word_index_start?: number | null;
          word_index_end?: number | null;
          is_matched?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "in_text_references_paper_analysis_id_fkey";
            columns: ["paper_analysis_id"];
            referencedRelation: "paper_analyses";
            referencedColumns: ["id"];
          },
        ];
      };

      bibliography_references: {
        Row: {
          id: string;
          paper_analysis_id: string;
          paper_upload_id: string;
          user_id: string;
          raw_text: string;
          authors: string[];
          title: string | null;
          year: string | null;
          publisher: string | null;
          journal: string | null;
          volume: string | null;
          issue: string | null;
          pages: string | null;
          doi: string | null;
          url: string | null;
          isbn: string | null;
          entry_index: number | null;
          page_number: number | null;
          health: Database["public"]["Enums"]["reference_health"];
          health_detail: string | null;
          health_checked_at: string | null;
          resolved_url: string | null;
          is_matched: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_analysis_id: string;
          paper_upload_id: string;
          user_id?: string;
          raw_text: string;
          authors?: string[];
          title?: string | null;
          year?: string | null;
          publisher?: string | null;
          journal?: string | null;
          volume?: string | null;
          issue?: string | null;
          pages?: string | null;
          doi?: string | null;
          url?: string | null;
          isbn?: string | null;
          entry_index?: number | null;
          page_number?: number | null;
          health?: Database["public"]["Enums"]["reference_health"];
          health_detail?: string | null;
          health_checked_at?: string | null;
          resolved_url?: string | null;
          is_matched?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_analysis_id?: string;
          paper_upload_id?: string;
          user_id?: string;
          raw_text?: string;
          authors?: string[];
          title?: string | null;
          year?: string | null;
          publisher?: string | null;
          journal?: string | null;
          volume?: string | null;
          issue?: string | null;
          pages?: string | null;
          doi?: string | null;
          url?: string | null;
          isbn?: string | null;
          entry_index?: number | null;
          page_number?: number | null;
          health?: Database["public"]["Enums"]["reference_health"];
          health_detail?: string | null;
          health_checked_at?: string | null;
          resolved_url?: string | null;
          is_matched?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bibliography_references_paper_analysis_id_fkey";
            columns: ["paper_analysis_id"];
            referencedRelation: "paper_analyses";
            referencedColumns: ["id"];
          },
        ];
      };

      reference_pairs: {
        Row: {
          id: string;
          paper_analysis_id: string;
          user_id: string;
          in_text_reference_id: string | null;
          bibliography_reference_id: string | null;
          match_confidence: number | null;
          is_orphan_in_text: boolean;
          is_orphan_bibliography: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_analysis_id: string;
          user_id?: string;
          in_text_reference_id?: string | null;
          bibliography_reference_id?: string | null;
          match_confidence?: number | null;
          is_orphan_in_text?: boolean;
          is_orphan_bibliography?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_analysis_id?: string;
          user_id?: string;
          in_text_reference_id?: string | null;
          bibliography_reference_id?: string | null;
          match_confidence?: number | null;
          is_orphan_in_text?: boolean;
          is_orphan_bibliography?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reference_pairs_in_text_reference_id_fkey";
            columns: ["in_text_reference_id"];
            referencedRelation: "in_text_references";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reference_pairs_bibliography_reference_id_fkey";
            columns: ["bibliography_reference_id"];
            referencedRelation: "bibliography_references";
            referencedColumns: ["id"];
          },
        ];
      };

      // ---------------------------------------------------------------- 09
      requirement_files: {
        Row: {
          id: string;
          user_id: string;
          institution_id: string | null;
          file_path: string;
          file_name: string;
          file_format: Database["public"]["Enums"]["file_format"];
          file_size_bytes: number;
          title: string;
          extraction_status: Database["public"]["Enums"]["job_status"];
          extraction_error: string | null;
          extracted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          institution_id?: string | null;
          file_path: string;
          file_name: string;
          file_format: Database["public"]["Enums"]["file_format"];
          file_size_bytes: number;
          title?: string;
          extraction_status?: Database["public"]["Enums"]["job_status"];
          extraction_error?: string | null;
          extracted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          institution_id?: string | null;
          file_path?: string;
          file_name?: string;
          file_format?: Database["public"]["Enums"]["file_format"];
          file_size_bytes?: number;
          title?: string;
          extraction_status?: Database["public"]["Enums"]["job_status"];
          extraction_error?: string | null;
          extracted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "requirement_files_institution_id_fkey";
            columns: ["institution_id"];
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };

      requirements: {
        Row: {
          id: string;
          requirement_file_id: string;
          user_id: string;
          code: string | null;
          title: string;
          description: string;
          category: string | null;
          source_quote: string | null;
          is_mandatory: boolean;
          is_enabled: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requirement_file_id: string;
          user_id?: string;
          code?: string | null;
          title: string;
          description?: string;
          category?: string | null;
          source_quote?: string | null;
          is_mandatory?: boolean;
          is_enabled?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requirement_file_id?: string;
          user_id?: string;
          code?: string | null;
          title?: string;
          description?: string;
          category?: string | null;
          source_quote?: string | null;
          is_mandatory?: boolean;
          is_enabled?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "requirements_requirement_file_id_fkey";
            columns: ["requirement_file_id"];
            referencedRelation: "requirement_files";
            referencedColumns: ["id"];
          },
        ];
      };

      upload_requirements: {
        Row: {
          id: string;
          paper_upload_id: string;
          requirement_id: string;
          paper_analysis_id: string | null;
          user_id: string;
          status: Database["public"]["Enums"]["job_status"];
          is_satisfied: boolean | null;
          evidence_quote: string | null;
          explanation: string | null;
          page_number: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_upload_id: string;
          requirement_id: string;
          paper_analysis_id?: string | null;
          user_id?: string;
          status?: Database["public"]["Enums"]["job_status"];
          is_satisfied?: boolean | null;
          evidence_quote?: string | null;
          explanation?: string | null;
          page_number?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_upload_id?: string;
          requirement_id?: string;
          paper_analysis_id?: string | null;
          user_id?: string;
          status?: Database["public"]["Enums"]["job_status"];
          is_satisfied?: boolean | null;
          evidence_quote?: string | null;
          explanation?: string | null;
          page_number?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "upload_requirements_paper_upload_id_fkey";
            columns: ["paper_upload_id"];
            referencedRelation: "paper_uploads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "upload_requirements_requirement_id_fkey";
            columns: ["requirement_id"];
            referencedRelation: "requirements";
            referencedColumns: ["id"];
          },
        ];
      };

      // ---------------------------------------------------------------- 10
      todo_groups: {
        Row: {
          id: string;
          paper_analysis_id: string;
          paper_id: string;
          user_id: string;
          title: string;
          description: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_analysis_id: string;
          paper_id: string;
          user_id?: string;
          title: string;
          description?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_analysis_id?: string;
          paper_id?: string;
          user_id?: string;
          title?: string;
          description?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "todo_groups_paper_analysis_id_fkey";
            columns: ["paper_analysis_id"];
            referencedRelation: "paper_analyses";
            referencedColumns: ["id"];
          },
        ];
      };

      todo_items: {
        Row: {
          id: string;
          todo_group_id: string;
          user_id: string;
          finding_id: string | null;
          check_result_id: string | null;
          title: string;
          description: string;
          page_number: number | null;
          is_done: boolean;
          completed_at: string | null;
          due_at: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          todo_group_id: string;
          user_id?: string;
          finding_id?: string | null;
          check_result_id?: string | null;
          title: string;
          description?: string;
          page_number?: number | null;
          is_done?: boolean;
          completed_at?: string | null;
          due_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          todo_group_id?: string;
          user_id?: string;
          finding_id?: string | null;
          check_result_id?: string | null;
          title?: string;
          description?: string;
          page_number?: number | null;
          is_done?: boolean;
          completed_at?: string | null;
          due_at?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "todo_items_todo_group_id_fkey";
            columns: ["todo_group_id"];
            referencedRelation: "todo_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "todo_items_finding_id_fkey";
            columns: ["finding_id"];
            referencedRelation: "findings";
            referencedColumns: ["id"];
          },
        ];
      };

      // ---------------------------------------------------------------- 11
      defense_question_groups: {
        Row: {
          id: string;
          paper_analysis_id: string;
          paper_id: string;
          user_id: string;
          title: string;
          description: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_analysis_id: string;
          paper_id: string;
          user_id?: string;
          title: string;
          description?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_analysis_id?: string;
          paper_id?: string;
          user_id?: string;
          title?: string;
          description?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "defense_question_groups_paper_analysis_id_fkey";
            columns: ["paper_analysis_id"];
            referencedRelation: "paper_analyses";
            referencedColumns: ["id"];
          },
        ];
      };

      defense_questions: {
        Row: {
          id: string;
          defense_question_group_id: string;
          user_id: string;
          question: string;
          reference_answer: string;
          source_quote: string | null;
          page_number: number | null;
          difficulty: Database["public"]["Enums"]["finding_severity"];
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          defense_question_group_id: string;
          user_id?: string;
          question: string;
          reference_answer?: string;
          source_quote?: string | null;
          page_number?: number | null;
          difficulty?: Database["public"]["Enums"]["finding_severity"];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          defense_question_group_id?: string;
          user_id?: string;
          question?: string;
          reference_answer?: string;
          source_quote?: string | null;
          page_number?: number | null;
          difficulty?: Database["public"]["Enums"]["finding_severity"];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "defense_questions_defense_question_group_id_fkey";
            columns: ["defense_question_group_id"];
            referencedRelation: "defense_question_groups";
            referencedColumns: ["id"];
          },
        ];
      };

      defense_practices: {
        Row: {
          id: string;
          paper_analysis_id: string;
          user_id: string;
          started_at: string;
          completed_at: string | null;
          question_count: number;
          answered_count: number;
          average_score: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_analysis_id: string;
          user_id?: string;
          started_at?: string;
          completed_at?: string | null;
          question_count?: number;
          answered_count?: number;
          average_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_analysis_id?: string;
          user_id?: string;
          started_at?: string;
          completed_at?: string | null;
          question_count?: number;
          answered_count?: number;
          average_score?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "defense_practices_paper_analysis_id_fkey";
            columns: ["paper_analysis_id"];
            referencedRelation: "paper_analyses";
            referencedColumns: ["id"];
          },
        ];
      };

      defense_question_answers: {
        Row: {
          id: string;
          defense_practice_id: string;
          defense_question_id: string;
          user_id: string;
          answer_text: string;
          score: number | null;
          feedback: string | null;
          answered_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          defense_practice_id: string;
          defense_question_id: string;
          user_id?: string;
          answer_text?: string;
          score?: number | null;
          feedback?: string | null;
          answered_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          defense_practice_id?: string;
          defense_question_id?: string;
          user_id?: string;
          answer_text?: string;
          score?: number | null;
          feedback?: string | null;
          answered_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "defense_question_answers_defense_practice_id_fkey";
            columns: ["defense_practice_id"];
            referencedRelation: "defense_practices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "defense_question_answers_defense_question_id_fkey";
            columns: ["defense_question_id"];
            referencedRelation: "defense_questions";
            referencedColumns: ["id"];
          },
        ];
      };

      // ---------------------------------------------------------------- 12
      analysis_jobs: {
        Row: {
          id: string;
          paper_analysis_id: string;
          paper_upload_id: string;
          user_id: string;
          kind: Database["public"]["Enums"]["job_kind"];
          status: Database["public"]["Enums"]["job_status"];
          payload: Json;
          priority: number;
          attempts: number;
          max_attempts: number;
          run_after: string;
          claimed_at: string | null;
          claimed_by: string | null;
          completed_at: string | null;
          last_error: string | null;
          idempotency_key: string;
          is_optional: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paper_analysis_id: string;
          paper_upload_id: string;
          user_id?: string;
          kind: Database["public"]["Enums"]["job_kind"];
          status?: Database["public"]["Enums"]["job_status"];
          payload?: Json;
          priority?: number;
          attempts?: number;
          max_attempts?: number;
          run_after?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          completed_at?: string | null;
          last_error?: string | null;
          idempotency_key: string;
          is_optional?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paper_analysis_id?: string;
          paper_upload_id?: string;
          user_id?: string;
          kind?: Database["public"]["Enums"]["job_kind"];
          status?: Database["public"]["Enums"]["job_status"];
          payload?: Json;
          priority?: number;
          attempts?: number;
          max_attempts?: number;
          run_after?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          completed_at?: string | null;
          last_error?: string | null;
          idempotency_key?: string;
          is_optional?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analysis_jobs_paper_analysis_id_fkey";
            columns: ["paper_analysis_id"];
            referencedRelation: "paper_analyses";
            referencedColumns: ["id"];
          },
        ];
      };

      token_usage: {
        Row: {
          id: number;
          paper_upload_id: string | null;
          paper_analysis_id: string | null;
          analysis_job_id: string | null;
          user_id: string | null;
          operation: Database["public"]["Enums"]["llm_operation"];
          model: string;
          calls: number;
          input_tokens: number;
          cached_input_tokens: number;
          output_tokens: number;
          cost_usd: number;
          latency_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          paper_upload_id?: string | null;
          paper_analysis_id?: string | null;
          analysis_job_id?: string | null;
          user_id?: string | null;
          operation: Database["public"]["Enums"]["llm_operation"];
          model: string;
          calls?: number;
          input_tokens?: number;
          cached_input_tokens?: number;
          output_tokens?: number;
          cost_usd?: number;
          latency_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          paper_upload_id?: string | null;
          paper_analysis_id?: string | null;
          analysis_job_id?: string | null;
          user_id?: string | null;
          operation?: Database["public"]["Enums"]["llm_operation"];
          model?: string;
          calls?: number;
          input_tokens?: number;
          cached_input_tokens?: number;
          output_tokens?: number;
          cost_usd?: number;
          latency_ms?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };

      // ---------------------------------------------------------------- 13
      upload_events: {
        Row: {
          id: number;
          paper_upload_id: string | null;
          user_id: string | null;
          event_type: string;
          detail: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          paper_upload_id?: string | null;
          user_id?: string | null;
          event_type: string;
          detail?: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          paper_upload_id?: string | null;
          user_id?: string | null;
          event_type?: string;
          detail?: Json;
          created_at?: string;
        };
        Relationships: [];
      };

      rate_limit_attempts: {
        Row: {
          id: number;
          bucket: string;
          identifier: string;
          user_id: string | null;
          attempted_at: string;
          succeeded: boolean;
          metadata: Json;
        };
        Insert: {
          id?: number;
          bucket: string;
          identifier: string;
          user_id?: string | null;
          attempted_at?: string;
          succeeded?: boolean;
          metadata?: Json;
        };
        Update: {
          id?: number;
          bucket?: string;
          identifier?: string;
          user_id?: string | null;
          attempted_at?: string;
          succeeded?: boolean;
          metadata?: Json;
        };
        Relationships: [];
      };

      admin_actions: {
        Row: {
          id: number;
          actor_user_id: string | null;
          target_user_id: string | null;
          action: Database["public"]["Enums"]["admin_action_type"];
          target_table: string | null;
          target_id: string | null;
          detail: Json;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          actor_user_id?: string | null;
          target_user_id?: string | null;
          action: Database["public"]["Enums"]["admin_action_type"];
          target_table?: string | null;
          target_id?: string | null;
          detail?: Json;
          reason?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };

      // ---------------------------------------------------------------- 14
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          title: string;
          body: string;
          href: string | null;
          related_paper_id: string | null;
          related_paper_analysis_id: string | null;
          read_at: string | null;
          emailed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: Database["public"]["Enums"]["notification_type"];
          title: string;
          body?: string;
          href?: string | null;
          related_paper_id?: string | null;
          related_paper_analysis_id?: string | null;
          read_at?: string | null;
          emailed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          title?: string;
          body?: string;
          href?: string | null;
          related_paper_id?: string | null;
          related_paper_analysis_id?: string | null;
          read_at?: string | null;
          emailed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_related_paper_id_fkey";
            columns: ["related_paper_id"];
            referencedRelation: "papers";
            referencedColumns: ["id"];
          },
        ];
      };

      notification_preferences: {
        Row: {
          user_id: string;
          email_analysis_complete: boolean;
          email_analysis_failed: boolean;
          email_reference_issues: boolean;
          email_todo_due_soon: boolean;
          email_weekly_digest: boolean;
          in_app_enabled: boolean;
          last_digest_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_analysis_complete?: boolean;
          email_analysis_failed?: boolean;
          email_reference_issues?: boolean;
          email_todo_due_soon?: boolean;
          email_weekly_digest?: boolean;
          in_app_enabled?: boolean;
          last_digest_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email_analysis_complete?: boolean;
          email_analysis_failed?: boolean;
          email_reference_issues?: boolean;
          email_todo_due_soon?: boolean;
          email_weekly_digest?: boolean;
          in_app_enabled?: boolean;
          last_digest_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };

    Views: {
      checks_public: {
        Row: {
          id: string | null;
          code: string | null;
          name_en: string | null;
          name_de: string | null;
          description_en: string | null;
          description_de: string | null;
          processing_mode:
            Database["public"]["Enums"]["processing_mode"] | null;
          page_scope: Database["public"]["Enums"]["page_type"][] | null;
          is_active: boolean | null;
          sort_order: number | null;
          active_version_id: string | null;
          active_version: number | null;
          active_version_locale:
            Database["public"]["Enums"]["app_locale"] | null;
        };
        Relationships: [];
      };
    };

    Functions: {
      is_owner: {
        Args: { record_user_id: string };
        Returns: boolean;
      };
      has_permission: {
        Args: { perm: Database["public"]["Enums"]["app_permission"] };
        Returns: boolean;
      };
      has_role: {
        Args: { target_role: Database["public"]["Enums"]["app_role"] };
        Returns: boolean;
      };
      claim_analysis_jobs: {
        Args: { p_worker_id: string; p_batch_size?: number };
        Returns: Database["public"]["Tables"]["analysis_jobs"]["Row"][];
      };
      complete_job: {
        Args: { p_job_id: string };
        Returns: undefined;
      };
      fail_job: {
        Args: { p_job_id: string; p_error: string };
        Returns: undefined;
      };
      reap_stale_jobs: {
        Args: { p_timeout?: string };
        Returns: number;
      };
      recompute_analysis_status: {
        Args: { p_analysis_id: string };
        Returns: undefined;
      };
    };

    Enums: {
      job_status: "NONE" | "GENERATING" | "DONE" | "ERROR";
      analysis_status: "GENERATING" | "DONE" | "ERROR";
      job_kind:
        | "COMPATIBILITY"
        | "PARSE"
        | "IDENTIFY_PAGES"
        | "RUN_CHECK"
        | "GRAMMAR"
        | "BIBLIOGRAPHY"
        | "REFERENCE_HEALTH"
        | "AI_DETECTION"
        | "TODO_LIST"
        | "DEFENSE_QUESTIONS"
        | "EXTRACT_REQUIREMENTS"
        | "POST_PROCESSING";
      page_type:
        | "COVER"
        | "ABSTRACT"
        | "TOC"
        | "LIST_OF_ABBREVIATIONS"
        | "BODY"
        | "BIBLIOGRAPHY"
        | "APPENDIX"
        | "OTHER";
      citation_style:
        | "APA_7"
        | "APA_6"
        | "MLA_9"
        | "CHICAGO_17"
        | "HARVARD"
        | "VANCOUVER"
        | "OXFORD"
        | "TURABIAN"
        | "IEEE"
        | "ISO_690";
      app_locale: "DE" | "EN";
      spelling_variant: "DE_CH" | "DE_DE" | "EN_UK" | "EN_US";
      processing_mode: "ALL_PAGES" | "INDIVIDUAL_PAGES";
      finding_type: "GRAMMAR" | "SPELLING" | "PUNCTUATION" | "STYLE";
      finding_severity: "LOW" | "MEDIUM" | "HIGH";
      reference_health:
        | "VERIFIED"
        | "NEEDS_CORRECTION"
        | "BROKEN_URL"
        | "NOT_FOUND"
        | "UNCHECKED";
      file_format: "PDF" | "DOCX";
      llm_operation:
        | "COMPATIBILITY"
        | "IDENTIFY_PAGES"
        | "GRAMMAR"
        | "RATED_CHECK"
        | "BIBLIOGRAPHY"
        | "DEFENSE_QUESTIONS"
        | "POST_PROCESSING"
        | "GENDERING"
        | "REFERENCE"
        | "REFERENCE_HEALTH"
        | "COMPARE_RESULTS"
        | "UNIVERSITY_EXTRACTION"
        | "EXTRACT_REQUIREMENTS";
      app_role: "ADMIN" | "USER" | "STATS_VIEWER" | "CHECK_MANAGER";
      app_permission:
        | "VIEW_ANALYTICS_DASHBOARD"
        | "VIEW_SHARED_PAPERS"
        | "MANAGE_CHECKS"
        | "MANAGE_CHECK_VERSIONS"
        | "FULL_DATA_ACCESS";
      notification_type:
        | "ANALYSIS_COMPLETE"
        | "ANALYSIS_FAILED"
        | "UPLOAD_INCOMPATIBLE"
        | "REFERENCE_ISSUES_FOUND"
        | "REQUIREMENTS_EXTRACTED"
        | "TODO_DUE_SOON";
      admin_action_type:
        | "GRANT_ROLE"
        | "REVOKE_ROLE"
        | "ANONYMIZE_USER"
        | "DELETE_USER"
        | "REQUEUE_ANALYSIS";
    };

    CompositeTypes: Record<never, never>;
  };
}

/** Convenience aliases used throughout `lib/domain` and `lib/db/queries`. */
export type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];

export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"];

export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];
