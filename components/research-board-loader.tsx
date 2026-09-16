"use client";
import dynamic from "next/dynamic";
import type { BoardCanvasProps } from "./research-board-canvas";
const Canvas = dynamic(() => import("./research-board-canvas").then(m => m.ResearchBoardCanvas), { ssr: false, loading: () => <p>Loading board...</p> });
export function ResearchBoardLoader(props: BoardCanvasProps) { return <Canvas {...props} />; }
