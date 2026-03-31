const axios = require("axios");
const { soundcloud: scDownload } = require("btch-downloader");

function isTrackUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (!url.includes("soundcloud.com")) return false;

  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname
      .split("/")
      .filter((s) => s.trim().length > 0);

    if (pathSegments.length < 2) return false;

    const invalidPaths = [
      "search",
      "charts",
      "discover",
      "groups",
      "popular",
      "tags",
      "settings",
      "login",
      "signup",
    ];
    if (invalidPaths.includes(pathSegments[0].toLowerCase())) return false;

    return true;
  } catch {
    return false;
  }
}

async function downloadTrack(url) {
  if (!isTrackUrl(url)) {
    return { success: false, error: "Invalid track URL", trackUrl: url };
  }

  const scResult = await scDownload(url);
  const oembed = await axios
    .get(
      `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`
    )
    .catch(() => null);

  const trackIdMatch = oembed?.data?.html?.match(/tracks%2F(\d+)/);
  const trackId = trackIdMatch ? trackIdMatch[1] : null;

  return {
    success: scResult.status && !!scResult.result?.audio,
    trackUrl: url,
    trackId: trackId,
    title: oembed?.data?.title || scResult.result?.title || null,
    artist: oembed?.data?.author_name || scResult.result?.author || null,
    artworkUrl: oembed?.data?.thumbnail_url || null,
    downloadUrl: scResult.result?.audio || null,
    downloadable: !!scResult.result?.audio,
    fetchedAt: new Date().toISOString(),
  };
}

async function runTests() {
  console.log("\n🧪 SoundCloud Validator + Download Tests\n" + "=".repeat(55));

  const validatorTests = [
    {
      url: "https://soundcloud.com/thechainsmokers/closer",
      expect: true,
      desc: "Valid track URL",
    },
    {
      url: "https://soundcloud.com/edsheeran/perfect",
      expect: true,
      desc: "Another valid track",
    },
    {
      url: "https://soundcloud.com/forss/flickermood",
      expect: true,
      desc: "Classic test track",
    },
    {
      url: "https://soundcloud.com/thechainsmokers",
      expect: false,
      desc: "Artist profile (2 segments)",
    },
    {
      url: "https://soundcloud.com/katyperry",
      expect: false,
      desc: "Artist profile",
    },
    {
      url: "https://soundcloud.com/search?q=lofi",
      expect: false,
      desc: "Search page",
    },
    {
      url: "https://soundcloud.com/charts",
      expect: false,
      desc: "Charts page",
    },
    {
      url: "https://soundcloud.com/charts/top",
      expect: false,
      desc: "Charts top",
    },
    {
      url: "https://soundcloud.com/discover",
      expect: false,
      desc: "Discover page",
    },
    {
      url: "https://soundcloud.com/drake/sets/mixtape",
      expect: true,
      desc: "Playlist URL (3+ segments)",
    },
    { url: "https://soundcloud.com", expect: false, desc: "Homepage only" },
  ];

  console.log("\n📋 VALIDATOR TESTS");
  console.log("-".repeat(55));

  let passed = 0;
  let failed = 0;

  for (const test of validatorTests) {
    const result = isTrackUrl(test.url);
    const status = result === test.expect;

    if (status) {
      passed++;
      console.log(`✅ Correct | ${test.desc}`);
    } else {
      failed++;
      console.log(`❌ WRONG  | ${test.desc}`);
      console.log(`         | URL: ${test.url.slice(0, 45)}`);
      console.log(`         | Expected: ${test.expect}, Got: ${result}`);
    }
  }

  console.log("\n📋 DOWNLOAD TESTS");
  console.log("-".repeat(55));

  const downloadTests = [
    {
      url: "https://soundcloud.com/thechainsmokers/closer",
      expectDownload: true,
    },
    { url: "https://soundcloud.com/edsheeran/perfect", expectDownload: true },
    { url: "https://soundcloud.com/thechainsmokers", expectDownload: false },
  ];

  for (const test of downloadTests) {
    const result = await downloadTrack(test.url);
    const status = result.downloadable === test.expectDownload;

    if (status) {
      passed++;
      console.log(
        `✅ Correct | ${
          result.downloadable ? "Downloadable" : "Protected"
        } | ${test.url.slice(0, 40)}`
      );
    } else {
      failed++;
      console.log(
        `❌ WRONG  | Expected download: ${test.expectDownload}, Got: ${result.downloadable}`
      );
    }
  }

  console.log("\n" + "=".repeat(55));
  console.log(`📊 TOTAL: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED! ✅\n");
  } else {
    console.log("⚠️  SOME TESTS FAILED\n");
  }

  return { passed, failed };
}

runTests().catch(console.error);
