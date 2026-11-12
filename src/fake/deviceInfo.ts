import type {DeviceInfo, DeviceType} from "ysdk";

type Device = {userAgent: string; platform: string; maxTouchPoints: number};

export function makeFakeDeviceInfo(device: Device): DeviceInfo {
  const tablet =
    /iPad|Tablet/i.test(device.userAgent) ||
    (device.platform === "MacIntel" && device.maxTouchPoints > 1) ||
    (/Android/i.test(device.userAgent) && !/Mobile/i.test(device.userAgent));
  const mobile = /Android|iPhone|iPod|Mobile/i.test(device.userAgent);
  const tv = /SmartTV|SMART-TV|HbbTV|Tizen|Web0S|WebOS/i.test(device.userAgent);
  const type = (tv ? "tv" : tablet ? "tablet" : mobile ? "mobile" : "desktop") as DeviceType;
  return {
    type,
    isDesktop: () => type === "desktop",
    isMobile: () => type === "mobile",
    isTablet: () => type === "tablet",
    isTV: () => type === "tv",
  };
}
