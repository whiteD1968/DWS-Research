"use client";
import dynamic from "next/dynamic";
import type { BoardCanvasProps } from "./research-board-canvas";
const Canvas = dynamic(() => import("./board-recovery").then(m => m.BoardRecovery), { ssr: false, loading: () => <p>Loading board...</p> });
export function ResearchBoardLoader(props: BoardCanvasProps) { return <Canvas key={`${props.board.id}:${props.transfer?.id || ""}`} {...props} />; }
