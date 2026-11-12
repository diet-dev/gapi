import type {Player} from "ysdk";

/** В наблюдаемом формате подписанного профиля mode может отсутствовать вместо пустой строки. */
export type YandexPlayerMode = ReturnType<Player["getMode"]>;

/** Разрешения на доступ к данным профиля не подтверждают авторизацию. */
export interface YandexPlayerScopePermissions {
  avatar?: string;
  public_name?: string;
  purchases_info?: string;
}

export interface YandexSignedPlayerData {
  uniqueID: string;
  id?: string;
  mode?: YandexPlayerMode;
  lang?: string;
  publicName?: string;
  avatarIdHash?: string;
  scopePermissions?: YandexPlayerScopePermissions;
  payingStatus?: ReturnType<Player["getPayingStatus"]>;
  hasPremium?: boolean;
}

/**
 * Схема подписанного профиля отсутствует в @types/ysdk, поэтому описана здесь.
 * Приведение к типу не проверяет HMAC. Перед использованием данных сервер должен
 * проверить подпись по исходным байтам и поля декодированного JSON.
 */
export interface YandexSignedPlayerPayload {
  algorithm: "HMAC-SHA256";
  /** Секунды Unix; не миллисекунды ysdk.serverTime(). */
  issuedAt: number;
  requestPayload: string;
  data: YandexSignedPlayerData;
}
