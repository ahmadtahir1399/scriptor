"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { IconAlert } from "@/components/icons";

import { useRouter } from "@/i18n/routing";
import { useFadeRise } from "@/lib/hooks/useReducedMotion";
import type { DocumentType } from "@/lib/domain/paper";
import type { PublicCheck } from "@/lib/domain/check";
import type { Requirement } from "@/lib/domain/requirement";
import {
  CITATION_STYLE_AUTO,
  type UploadSettings,
} from "@/lib/validations/upload";
import { classifyCheckable } from "@/lib/requirements/classifyCheckable";
import { APPLY_CUSTOM_CHECKS_BY_DEFAULT } from "@/lib/requirements/config";
import { useUpload } from "@/hooks/useUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionCard } from "@/components/shared/SectionCard";
import { RequirementPicker } from "@/components/requirements/RequirementPicker";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import {
  UploadSettingsForm,
  type UploadSettingsValue,
} from "@/components/upload/UploadSettingsForm";
import { CheckSelector } from "@/components/upload/CheckSelector";
import {
  PrivacyOptions,
  type PrivacyOptionsValue,
} from "@/components/upload/PrivacyOptions";
import { UploadFooterBar } from "@/components/upload/UploadFooterBar";

export interface UploadWizardProps {
  documentTypes: DocumentType[];
  checks: PublicCheck[];
  /**
   * When present, this upload is a NEW VERSION of an existing paper: it is bound
   * to that paper instead of creating a new one. The same wizard, not a fork.
   */
  paperId?: string;
  /** The student's own requirements, offered as an optional custom-check step. */
  requirements?: Requirement[];
}

/**
 * The four-step upload flow.
 *
 * Client component holding the whole draft state. Steps 2–4 appear only once a
 * file is chosen, so the first screen is a single obvious action rather than a
 * wall of settings for a document that does not exist yet.
 */
export function UploadWizard({
  documentTypes,
  checks,
  paperId,
  requirements = [],
}: UploadWizardProps) {
  const t = useTranslations("upload");
  const router = useRouter();
  const fadeRise = useFadeRise();

  const [file, setFile] = React.useState<File | null>(null);

  // Custom requirements — an optional step, present only when the student has
  // any. Supported ones are pre-selected per preference; unsupported ones are
  // shown but not selectable inside the picker.
  const [useCustomRequirements, setUseCustomRequirements] =
    React.useState(false);
  const [requirementIds, setRequirementIds] = React.useState<Set<string>>(
    () => {
      if (!APPLY_CUSTOM_CHECKS_BY_DEFAULT) return new Set();
      return new Set(
        requirements
          .filter(
            (requirement) =>
              classifyCheckable(
                `${requirement.title} ${requirement.description}`,
                requirement.category,
              ).checkable,
          )
          .map((requirement) => requirement.id),
      );
    },
  );

  const [settings, setSettings] = React.useState<UploadSettingsValue>({
    documentTypeCode: "",
    locale: "EN",
    spelling: "EN_UK",
    citationStyle: CITATION_STYLE_AUTO,
  });

  // Every check on by default — a student who wants fewer can opt out, but the
  // useful default is a complete review.
  const [checkIds, setCheckIds] = React.useState<string[]>(() =>
    checks.map((check) => check.id).filter((id): id is string => id !== null),
  );

  const [privacy, setPrivacy] = React.useState<PrivacyOptionsValue>({
    autoDelete: true,
    sendEmailResults: true,
  });

  const { submit, isUploading, progress, error } = useUpload((uploadId) => {
    router.push(`/upload/${uploadId}`);
  });

  const canSubmit =
    file !== null && settings.documentTypeCode !== "" && checkIds.length > 0;

  const onSubmit = () => {
    if (!file || !canSubmit) return;

    const payload: UploadSettings = {
      fileName: file.name,
      fileSizeBytes: file.size,
      documentTypeCode: settings.documentTypeCode,
      locale: settings.locale,
      spelling: settings.spelling,
      citationStyle: settings.citationStyle,
      checkIds,
      autoDelete: privacy.autoDelete,
      sendEmailResults: privacy.sendEmailResults,
    };

    submit(
      file,
      payload,
      paperId,
      useCustomRequirements ? [...requirementIds] : undefined,
    );
  };

  return (
    <div>
      {error ? (
        <Alert variant="critical" className="mb-6">
          <IconAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-6">
        <SectionCard
          title={t("step1.title")}
          description={t("step1.description")}
        >
          <UploadDropzone
            file={file}
            onFileChange={setFile}
            disabled={isUploading}
          />
        </SectionCard>

        {file ? (
          <motion.div
            initial={fadeRise.initial}
            animate={fadeRise.animate}
            transition={fadeRise.transition}
            className="flex flex-col gap-6"
          >
            <SectionCard
              title={t("step2.title")}
              description={t("step2.description")}
            >
              <UploadSettingsForm
                documentTypes={documentTypes}
                value={settings}
                onChange={setSettings}
                disabled={isUploading}
              />
            </SectionCard>

            <SectionCard
              title={t("step3.title")}
              description={t("step3.description")}
            >
              <CheckSelector
                checks={checks}
                selectedIds={checkIds}
                onChange={setCheckIds}
                disabled={isUploading}
              />
            </SectionCard>

            <SectionCard
              title={t("step4.title")}
              description={t("step4.description")}
            >
              <PrivacyOptions
                value={privacy}
                onChange={setPrivacy}
                disabled={isUploading}
              />
            </SectionCard>

            {requirements.length > 0 ? (
              <SectionCard
                title={t("requirements.title")}
                description={t("requirements.description")}
              >
                <label className="flex items-center gap-2 text-body">
                  <Checkbox
                    checked={useCustomRequirements}
                    onCheckedChange={(value) =>
                      setUseCustomRequirements(value === true)
                    }
                    disabled={isUploading}
                  />
                  {t("requirements.toggle")}
                </label>

                {useCustomRequirements ? (
                  <div className="mt-4">
                    <RequirementPicker
                      requirements={requirements}
                      selectedIds={requirementIds}
                      onChange={setRequirementIds}
                    />
                  </div>
                ) : null}
              </SectionCard>
            ) : null}
          </motion.div>
        ) : null}
      </div>

      <UploadFooterBar
        fileName={file?.name ?? null}
        fileSizeLabel={
          file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : null
        }
        canSubmit={canSubmit}
        isUploading={isUploading}
        progress={progress}
        onSubmit={onSubmit}
      />
    </div>
  );
}
