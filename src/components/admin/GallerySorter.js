"use client";

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, Star, Maximize2 } from 'lucide-react';
import { getOptimizedImage } from '@/lib/cloudinary';

function SortableItem({ url, onRemove, onSetFeatured, isFeatured }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const ctrl = { width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #c3c4c7", borderRadius: 3, background: "#fff", cursor: "pointer", boxShadow: "0 1px 1px rgba(0,0,0,0.04)" };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: "#f0f0f1", boxShadow: isFeatured ? "inset 0 0 0 3px #fff, 0 0 0 2px #2271b1" : "inset 0 0 0 1px rgba(0,0,0,0.08)" }}
      className="relative group aspect-square overflow-hidden"
    >
      <img
        src={getOptimizedImage(url, 'thumbnail')}
        alt=""
        className="w-full h-full object-cover cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
        loading="lazy"
      />

      {/* Controls Overlay */}
      <div className="absolute flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100" style={{ top: 4, right: 4 }}>
        <button
          type="button"
          onClick={() => onSetFeatured(url)}
          title="Set as featured"
          aria-label="Set as featured"
          aria-pressed={isFeatured}
          style={{ ...ctrl, color: isFeatured ? "#fff" : "#646970", background: isFeatured ? "#2271b1" : "#fff", borderColor: isFeatured ? "#2271b1" : "#c3c4c7" }}
        >
          <Star className={`w-3.5 h-3.5 ${isFeatured ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(url)}
          title="Remove image"
          aria-label="Remove image"
          style={{ ...ctrl, color: "#b32d2e" }}
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {isFeatured && (
        <div className="absolute inset-x-0 bottom-0 text-center" style={{ background: "rgba(34,113,177,0.92)", color: "#fff", fontSize: 12, padding: "2px 0" }}>
          Featured
        </div>
      )}
    </div>
  );
}

export default function GallerySorter({ images, onChange, featuredImage, onSetFeatured }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = images.indexOf(active.id);
      const newIndex = images.indexOf(over.id);
      onChange(arrayMove(images, oldIndex, newIndex));
    }
  };

  const removeImage = (url) => {
    onChange(images.filter(img => img !== url));
  };

  // The featured/main image is images[0] (ProductForm's "Product image" and the
  // storefront both read images[0]), so "Set as featured" moves it to the front.
  const setFeatured = (url) => {
    const idx = images.indexOf(url);
    if (idx > 0) onChange(arrayMove(images, idx, 0));
    if (onSetFeatured) onSetFeatured(url);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={images}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
          {images.map((url, i) => (
            <SortableItem
              key={url}
              url={url}
              onRemove={removeImage}
              onSetFeatured={setFeatured}
              isFeatured={featuredImage !== undefined ? url === featuredImage : i === 0}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
