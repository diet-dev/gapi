import type {YandexSignedPlayerPayload} from "../../src/yandex.ts";

// Синтетические данные без реальных ID и подписи; не доказательство для сервера.
export const guestYandexPlayerPayload = {
  algorithm: "HMAC-SHA256",
  issuedAt: 1800000000,
  requestPayload: "",
  data: {
    id: "synthetic-guest-legacy-id",
    uniqueID: "synthetic-guest-unique-id",
    lang: "",
    publicName: "",
    avatarIdHash: "synthetic-guest-avatar",
    mode: "lite",
    scopePermissions: {avatar: "not_set", public_name: "not_set", purchases_info: "allow"},
    payingStatus: "unknown",
    hasPremium: false,
  },
} satisfies YandexSignedPlayerPayload;

export const authorizedYandexPlayerPayload = {
  algorithm: "HMAC-SHA256",
  issuedAt: 1800000000,
  requestPayload: "",
  data: {
    id: "synthetic-account-legacy-id",
    uniqueID: "synthetic-account-unique-id",
    lang: "ru",
    publicName: "Тестовый игрок",
    avatarIdHash: "synthetic-account-avatar",
    scopePermissions: {avatar: "allow", public_name: "allow", purchases_info: "allow"},
    payingStatus: "unknown",
    hasPremium: false,
  },
} satisfies YandexSignedPlayerPayload;
