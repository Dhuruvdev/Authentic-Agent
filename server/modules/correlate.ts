import type { CorrelationResult } from "@shared/schema";

interface PlatformCheck {
  platform: string;
  url: string;
  checkMethod: "existence" | "availability_api";
}

const PLATFORMS: PlatformCheck[] = [
  { platform: "GitHub", url: "https://github.com/{username}", checkMethod: "existence" },
  { platform: "Twitter/X", url: "https://twitter.com/{username}", checkMethod: "existence" },
  { platform: "Instagram", url: "https://instagram.com/{username}", checkMethod: "existence" },
  { platform: "Reddit", url: "https://reddit.com/user/{username}", checkMethod: "existence" },
  { platform: "LinkedIn", url: "https://linkedin.com/in/{username}", checkMethod: "existence" },
  { platform: "Medium", url: "https://medium.com/@{username}", checkMethod: "existence" },
  { platform: "YouTube", url: "https://youtube.com/@{username}", checkMethod: "existence" },
  { platform: "TikTok", url: "https://tiktok.com/@{username}", checkMethod: "existence" },
  { platform: "Pinterest", url: "https://pinterest.com/{username}", checkMethod: "existence" },
  { platform: "Twitch", url: "https://twitch.tv/{username}", checkMethod: "existence" },
];

async function checkPlatformExists(platform: PlatformCheck, username: string): Promise<{
  platform: string;
  url: string;
  available: boolean;
  confidence: number;
}> {
  const url = platform.url.replace("{username}", encodeURIComponent(username));
  
  try {
    // We use a HEAD request with a timeout to check if the profile exists
    // Note: This is a basic check - many platforms block automated requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NothingHide/1.0; +https://nothinghide.app)",
      },
      redirect: "follow",
    });
    
    clearTimeout(timeoutId);
    
    // 200 = profile exists (username taken)
    // 404 = profile doesn't exist (username available)
    // Other = uncertain
    if (response.status === 200) {
      return {
        platform: platform.platform,
        url,
        available: false, // Username is taken = profile exists
        confidence: 0.8,
      };
    } else if (response.status === 404) {
      return {
        platform: platform.platform,
        url,
        available: true, // Username is available
        confidence: 0.7,
      };
    }
    
    // For other status codes, we can't be sure
    return {
      platform: platform.platform,
      url,
      available: true, // Assume available if we can't confirm
      confidence: 0.3,
    };
  } catch (error) {
    // Request failed (timeout, blocked, etc.)
    return {
      platform: platform.platform,
      url,
      available: true, // Unknown, assume available
      confidence: 0.2,
    };
  }
}

export async function correlateUsername(username: string): Promise<CorrelationResult> {
  // Run checks in parallel with a reasonable subset of platforms
  const platformsToCheck = PLATFORMS.slice(0, 6); // Check first 6 platforms to avoid rate limits
  
  const results = await Promise.all(
    platformsToCheck.map((platform) => checkPlatformExists(platform, username))
  );
  
  const foundPlatforms = results.filter((r) => !r.available && r.confidence >= 0.5);
  
  // Calculate risk based on how many platforms the username appears on
  let risk: "low" | "medium" | "high";
  if (foundPlatforms.length >= 4) {
    risk = "high";
  } else if (foundPlatforms.length >= 2) {
    risk = "medium";
  } else {
    risk = "low";
  }

  return {
    matches: results.map((r) => ({
      platform: r.platform,
      url: r.available ? undefined : r.url,
      available: r.available,
      confidence: r.confidence,
    })),
    risk,
    checkedPlatforms: platformsToCheck.map((p) => p.platform),
    limitationNote: "Platform checks use basic HTTP requests. Some platforms may block automated access, leading to false negatives. Results should be verified manually for critical decisions.",
  };
}

export async function correlateEmail(email: string): Promise<CorrelationResult> {
  // For emails, we extract the username part and check that
  const atIndex = email.indexOf("@");
  if (atIndex === -1) {
    return {
      matches: [],
      risk: "low",
      checkedPlatforms: [],
      limitationNote: "Invalid email format for username extraction.",
    };
  }
  
  const username = email.substring(0, atIndex);
  
  // Only check if the username part is valid
  if (username.length < 3 || !/^[a-zA-Z0-9._-]+$/.test(username)) {
    return {
      matches: [],
      risk: "low",
      checkedPlatforms: [],
      limitationNote: "Email username part is too short or contains invalid characters for platform correlation.",
    };
  }
  
  const result = await correlateUsername(username);
  result.limitationNote = `Checked username "${username}" extracted from email. ${result.limitationNote}`;
  
  return result;
}
