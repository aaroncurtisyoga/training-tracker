import type { MetadataRoute } from "next";

// The tracker is single-user and admin-gated. Its own origin means a blanket
// disallow costs the public site nothing, which was not possible while this
// lived at aaroncurtisyoga.com/train.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
