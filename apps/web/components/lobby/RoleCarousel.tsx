import type { GameFamily, RoleCode, RoleDistribution } from "@werewolf/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { RoleTileLarge } from "@/components/lobby/RoleTileLarge";

export function RoleCarousel({
  family,
  roles,
  distribution,
  readonly = false,
  onIncrement,
  onDecrement,
  onOpen,
  layout = "carousel",
}: {
  family: GameFamily;
  roles: RoleCode[];
  distribution: RoleDistribution;
  readonly?: boolean;
  onIncrement?: (role: RoleCode) => void;
  onDecrement?: (role: RoleCode) => void;
  onOpen: (role: RoleCode) => void;
  layout?: "carousel" | "workspace";
}) {
  const galleryId = useId();
  const galleryRef = useRef<HTMLDivElement>(null);
  const [canMoveBack, setCanMoveBack] = useState(false);
  const [canMoveForward, setCanMoveForward] = useState(false);

  const updateNavigation = useCallback(() => {
    const gallery = galleryRef.current;
    if (!gallery) {
      return;
    }
    setCanMoveBack(gallery.scrollLeft > 4);
    setCanMoveForward(gallery.scrollLeft + gallery.clientWidth < gallery.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(updateNavigation);
    const gallery = galleryRef.current;
    const resizeObserver = gallery && "ResizeObserver" in window ? new ResizeObserver(updateNavigation) : null;
    if (gallery && resizeObserver) {
      resizeObserver.observe(gallery);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, [roles, updateNavigation]);

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery || layout !== "workspace") {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (
        gallery.scrollWidth <= gallery.clientWidth ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX)
      ) {
        return;
      }
      event.preventDefault();
      gallery.scrollBy({ left: event.deltaY, behavior: "auto" });
    };

    gallery.addEventListener("wheel", handleWheel, { passive: false });
    return () => gallery.removeEventListener("wheel", handleWheel);
  }, [layout]);

  if (roles.length === 0) {
    return <p className="role-carousel-empty">Няма роли за този филтър.</p>;
  }

  function moveGallery(direction: -1 | 1) {
    const gallery = galleryRef.current;
    if (!gallery) {
      return;
    }
    gallery.scrollBy({ left: direction * Math.max(180, gallery.clientWidth * 0.78), behavior: "smooth" });
  }

  return (
    <div className="role-gallery-frame" data-layout={layout}>
      <div className="role-gallery-controls">
        <span>{roles.length} роли</span>
        <div>
          <button
            type="button"
            aria-label="Предишни роли"
            aria-controls={galleryId}
            disabled={!canMoveBack}
            onClick={() => moveGallery(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Следващи роли"
            aria-controls={galleryId}
            disabled={!canMoveForward}
            onClick={() => moveGallery(1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        ref={galleryRef}
        id={galleryId}
        className="role-carousel"
        role="region"
        aria-label="Избор на роли"
        tabIndex={0}
        data-layout={layout}
        onScroll={updateNavigation}
      >
        {roles.map((role) => (
          <RoleTileLarge
            key={role}
            family={family}
            role={role}
            count={distribution[role] ?? 0}
            readonly={readonly}
            onIncrement={() => onIncrement?.(role)}
            onDecrement={() => onDecrement?.(role)}
            onOpen={() => onOpen(role)}
          />
        ))}
      </div>
    </div>
  );
}
