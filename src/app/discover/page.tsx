import { Suspense } from "react";
import { DiscoverView } from "@/components/discover/discover-view";

export default function DiscoverPage() {
  return (
    <Suspense fallback={null}>
      <DiscoverView />
    </Suspense>
  );
}
