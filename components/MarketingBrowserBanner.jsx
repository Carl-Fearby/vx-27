"use client";

import { useEffect, useState } from "react";
import { detectChromeBrowser } from "@/lib/isChromeBrowser";

export function useNonChromeBrowser() {
  const [isNonChrome, setIsNonChrome] = useState(false);

  useEffect(() => {
    const isChrome = detectChromeBrowser();
    if (isChrome === false) setIsNonChrome(true);
  }, []);

  return isNonChrome;
}

export default function MarketingBrowserBanner() {
  return (
    <div className="mktBrowserBanner" role="alert">
      <span className="mktBrowserBannerLabel">Browser notice</span>
      <p className="mktBrowserBannerText">
        VX-27 is built for{" "}
        <strong>Google Chrome</strong>. Other browsers may have poor performance or
        broken controls — switch to Chrome for the full experience.
      </p>
    </div>
  );
}
