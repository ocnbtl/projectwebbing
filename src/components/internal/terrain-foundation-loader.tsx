"use client";
import dynamic from "next/dynamic";
export const TerrainFoundationLoader = dynamic(() => import("./terrain-foundation").then(module => module.TerrainFoundation), { ssr: false, loading: () => <p>Loading terrain study…</p> });
