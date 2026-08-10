"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

type ToastFeedbackProps = {
  error?: string;
  success?: string;
};

export function ToastFeedback({ error, success }: ToastFeedbackProps) {
  const router = useRouter();
  const lastShownRef = useRef<string | null>(null);
  const message = error ?? success;
  const type = error ? "error" : "success";

  useEffect(() => {
    if (!message) {
      lastShownRef.current = null;
      return;
    }

    const signature = `${type}:${message}`;
    if (lastShownRef.current === signature) {
      return;
    }

    lastShownRef.current = signature;

    if (type === "error") {
      toast.error(message, { duration: 6000 });
    } else {
      toast.success(message, { duration: 4000 });
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    url.searchParams.delete("success");

    const query = url.searchParams.toString();
    router.replace(`${url.pathname}${query ? `?${query}` : ""}${url.hash}`, {
      scroll: false,
    });
  }, [message, router, type]);

  return null;
}
