import type { Metadata } from "next";
import { MapPage } from "@/features/map/MapPage";

export const metadata: Metadata = {
  title: "Bản đồ kinh tế số",
};

export default function Page() {
  return <MapPage />;
}
