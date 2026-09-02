import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AIChatSheet } from "./ai-chat-sheet";

describe("AIChatSheet", () => {
  it("submits a suggested question and closes accessibly", async () => {
    const onAsk = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<AIChatSheet open instrument="BTC-USDT" isAsking={false} response={null} error={null} onAsk={onAsk} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "当前最大的波动风险是什么？" }));
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    await waitFor(() => expect(onAsk).toHaveBeenCalledWith("当前最大的波动风险是什么？"));

    fireEvent.click(screen.getByRole("button", { name: "关闭 AI 助手" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not mount a hidden dialog", () => {
    render(<AIChatSheet open={false} instrument="BTC-USDT" isAsking={false} response={null} error={null} onAsk={async () => undefined} onClose={() => undefined} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
