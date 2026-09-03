import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AIChatSheet } from "./ai-chat-sheet";

const guidance = {
  title: "这个问题不在行情助手的能力范围内",
  message: "我目前只回答数字资产行情、风险、盘口和订单影响相关问题。",
  suggestions: ["BTC 当前最大的风险是什么？", "ETH 和 SOL 哪个短期波动更高？"],
};

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

  it("renders out-of-scope guidance as an answer with supported suggestions", () => {
    render(<AIChatSheet open instrument="BTC-USDT" isAsking={false} response={null} guidance={guidance} error={null} onAsk={async () => undefined} onClose={() => undefined} />);

    expect(screen.getByText(guidance.title)).toBeInTheDocument();
    expect(screen.getByText(guidance.message)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: guidance.suggestions[0] })).toBeInTheDocument();
  });
});
