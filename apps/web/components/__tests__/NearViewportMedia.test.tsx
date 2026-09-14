import { act, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NearViewportMedia } from "../NearViewportMedia";

const art = <img src="/art.webp" srcSet="/art.webp 1x, /art@2x.webp 2x" alt="" width={520} height={780} loading="lazy" />;

function observerMock() {
  let notify: IntersectionObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();
  const Observer = vi.fn(function (callback: IntersectionObserverCallback) {
    notify = callback;
    return { observe, disconnect };
  });
  vi.stubGlobal("IntersectionObserver", Observer);
  return {
    Observer, observe, disconnect,
    intersect(isIntersecting: boolean) {
      act(() => notify([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("near-viewport decorative media", () => {
  it("observes the reserved parent and leaves distant art inert until near the viewport", () => {
    const observer = observerMock();
    const { container, unmount } = render(<div data-testid="box"><NearViewportMedia>{art}</NearViewportMedia></div>);
    const box = container.firstElementChild!;
    expect(observer.observe).toHaveBeenCalledWith(box);
    expect(observer.Observer).toHaveBeenCalledWith(expect.any(Function), { rootMargin: "160px 0px" });
    expect(box.querySelector("img")).toBeNull();
    expect(box.firstElementChild).toHaveStyle({ display: "contents" });
    observer.intersect(false);
    expect(box.querySelector("img")).toBeNull();

    observer.intersect(true);
    const image = box.querySelector("img")!;
    expect(image).toHaveAttribute("src", "/art.webp");
    expect(image).toHaveAttribute("srcset", "/art.webp 1x, /art@2x.webp 2x");
    expect(image).toHaveAttribute("width", "520");
    expect(image).toHaveAttribute("height", "780");
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    observer.intersect(false);
    expect(box.querySelector("img")).toBe(image);
    unmount();
    expect(observer.disconnect).toHaveBeenCalledTimes(2);
  });

  it("disconnects when unmounted before becoming visible", () => {
    const observer = observerMock();
    const { unmount } = render(<div><NearViewportMedia>{art}</NearViewportMedia></div>);
    unmount();
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });

  it("loads immediately when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<div><NearViewportMedia>{art}</NearViewportMedia></div>);
    expect(container.querySelector("img")).toHaveAttribute("src", "/art.webp");
  });

  it("server-renders the complete original art only inside the no-JS fallback", () => {
    const html = renderToString(<div><NearViewportMedia>{art}</NearViewportMedia></div>);
    expect(html).toContain('<span style="display:contents"></span><noscript><img');
    expect(html).toContain('srcSet="/art.webp 1x, /art@2x.webp 2x"');
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html).not.toContain('rel="preload"');
  });
});
