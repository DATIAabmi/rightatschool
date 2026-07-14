"use client";

import {
  MetabaseProvider,
  defineMetabaseAuthConfig,
} from "@metabase/embedding-sdk-react";
import { useRouter } from "next/navigation";

// Local-dev-only auth: Metabase's docs recommend testing the Embedding SDK on
// localhost via an API key instead of setting up JWT/SAML SSO. Switch this to
// jwtProviderUri-based auth before deploying anywhere beyond local dev.
const authConfig = defineMetabaseAuthConfig({
  metabaseInstanceUrl: process.env.NEXT_PUBLIC_METABASE_URL!,
  apiKey: process.env.NEXT_PUBLIC_METABASE_API_KEY!,
});

export default function MetabaseProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const pluginsConfig = {
    // Single-click district drill-through: returning { onClick } skips the
    // Metabase popup entirely and fires the handler directly on cell click.
    mapQuestionClickActions: (
      _clickActions: unknown[],
      clickedDataPoint: {
        value?: string | number | null;
        column?: { name?: string; display_name?: string };
      }
    ) => {
      const colName = clickedDataPoint?.column?.name ?? "";
      const value = clickedDataPoint?.value;

      if (
        (colName === "District" || colName.toLowerCase() === "district") &&
        value != null &&
        value !== ""
      ) {
        return {
          onClick: () => {
            router.push(
              `/school-board-minutes?district=${encodeURIComponent(String(value))}`
            );
          },
        };
      }

      return _clickActions as import("@metabase/embedding-sdk-react").MetabaseClickAction[];
    },

    // Fallback: same-origin URL click behaviors navigate in-app
    handleLink: (url: string): { handled: boolean } => {
      try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.origin === window.location.origin) {
          router.push(parsed.pathname + parsed.search);
          return { handled: true };
        }
      } catch {
        if (url.startsWith("/")) {
          router.push(url);
          return { handled: true };
        }
      }
      return { handled: false };
    },
  };

  return (
    <MetabaseProvider
      authConfig={authConfig}
      theme={{ fontFamily: "inherit" }}
      pluginsConfig={pluginsConfig}
    >
      {children}
    </MetabaseProvider>
  );
}
