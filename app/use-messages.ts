"use client";

import {
  getMessages,
  type Messages,
} from "../lib/messages";
import { useLocale } from "./locale-provider";

export function useMessages(): Messages {
  const { locale } = useLocale();

  return getMessages(locale);
}
