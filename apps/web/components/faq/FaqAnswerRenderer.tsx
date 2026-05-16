"use client";

import Image from "next/image";
import Link from "next/link";
import type { AnswerBlock, AnswerLink } from "@/lib/faq-data";

export function FaqAnswerRenderer({ blocks }: { blocks: readonly AnswerBlock[] }) {
  return (
    <div className="faq-answer">
      {blocks.map((block, index) => (
        <BlockRenderer key={index} block={block} />
      ))}
    </div>
  );
}

function BlockRenderer({ block }: { block: AnswerBlock }) {
  switch (block.type) {
    case "tldr":
      return (
        <div className="faq-block-tldr">
          <span className="faq-block-tldr-label">Накратко</span>
          <span className="faq-block-tldr-text">{block.text}</span>
        </div>
      );

    case "paragraph":
      return (
        <p className="faq-block-paragraph">
          {block.text}
          {block.links?.map((link) => (
            <LinkRenderer key={link.href} link={link} />
          ))}
        </p>
      );

    case "steps":
      return (
        <ol className="faq-block-steps">
          {block.items.map((step, index) => (
            <li key={step}>
              <span className="faq-step-marker">{index + 1}</span>
              <span className="faq-step-text">{step}</span>
            </li>
          ))}
        </ol>
      );

    case "bullets":
      return (
        <ul className="faq-block-bullets">
          {block.items.map((bullet) => (
            <li key={bullet}>
              <span className="faq-bullet-marker" aria-hidden />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      );

    case "callout":
      return (
        <aside className={`faq-block-callout faq-block-callout-${block.tone}`}>
          <span className="faq-callout-icon" aria-hidden>
            {block.tone === "warning" ? "⚠" : "ℹ"}
          </span>
          <span>{block.text}</span>
        </aside>
      );

    case "link-list":
      return (
        <nav className="faq-block-link-list" aria-label={block.title}>
          <p className="faq-link-list-title">{block.title}</p>
          <ul>
            {block.links.map((link) => (
              <li key={link.href}>
                <LinkRenderer link={link} />
              </li>
            ))}
          </ul>
        </nav>
      );

    case "image":
      return (
        <figure className="faq-block-image">
          <Image
            src={block.src}
            alt={block.alt}
            width={1500}
            height={500}
            sizes="(max-width: 768px) 100vw, 800px"
            className="faq-block-image-img"
          />
          {block.caption ? <figcaption>{block.caption}</figcaption> : null}
        </figure>
      );
  }
}

function LinkRenderer({ link }: { link: AnswerLink }) {
  if (link.internal !== false && link.href.startsWith("/")) {
    return (
      <Link href={link.href} className="faq-link">
        {link.text}
      </Link>
    );
  }

  return (
    <a
      href={link.href}
      target={link.href.startsWith("http") ? "_blank" : undefined}
      rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
      className="faq-link"
    >
      {link.text}
    </a>
  );
}
