"use client";

import * as React from "react";
import GjsEditor from "@grapesjs/react";
import webpagePreset from "grapesjs-preset-webpage";
import gjsBlocksBasic from "grapesjs-blocks-basic";
import { DEMO_TEMPLATE } from "@/lib/demo-template";

export function WebsiteEditor() {
  return (
    <div className="h-[calc(100vh-2rem)] w-full border rounded-lg overflow-hidden flex flex-col bg-slate-50 shadow-sm relative">
      <GjsEditor
        className="flex-grow flex flex-col overflow-hidden relative"
        grapesjs="https://unpkg.com/grapesjs"
        grapesjsCss="https://unpkg.com/grapesjs/dist/css/grapes.min.css"
        options={{
          height: "100%",
          storageManager: false,
          components: DEMO_TEMPLATE,
          plugins: [webpagePreset, gjsBlocksBasic],
          pluginsOpts: {
            [webpagePreset as any]: {
              // Enable default panels and options
            },
            [gjsBlocksBasic as any]: {
              flexGrid: true,
            },
          },
          deviceManager: {
            devices: [
              {
                id: 'desktop',
                name: 'Desktop',
                width: '',
              },
              {
                id: 'tablet',
                name: 'Tablet',
                width: '768px',
                widthMedia: '992px',
              },
              {
                id: 'mobileLandscape',
                name: 'Mobile landscape',
                width: '568px',
                widthMedia: '768px',
              },
              {
                id: 'mobilePortrait',
                name: 'Mobile portrait',
                width: '320px',
                widthMedia: '480px',
              },
            ],
          },
        }}
      />
      <style jsx global>{`
        /* GrapesJS Theme Overrides */
        .gjs-one-bg {
          background-color: hsl(var(--background)) !important;
        }
        
        .gjs-two-color {
          color: hsl(var(--foreground)) !important;
        }
        
        .gjs-three-bg {
          background-color: hsl(var(--primary)) !important;
          color: hsl(var(--primary-foreground)) !important;
        }
        
        .gjs-four-color,
        .gjs-four-color-h:hover {
          color: hsl(var(--primary)) !important;
        }
        
        /* Panels & Toolbars */
        .gjs-pn-panel {
            background-color: hsl(var(--background)) !important;
            border-bottom: 1px solid hsl(var(--border)) !important;
            box-shadow: none !important;
        }
        
        .gjs-pn-buttons {
            border-right: 1px solid hsl(var(--border)) !important;
        }
        
        .gjs-pn-btn {
            color: hsl(var(--foreground)) !important;
            border-radius: 0.375rem !important; /* rounded-md */
            margin: 2px !important;
            height: 36px !important;
            box-shadow: none !important;
            background-color: transparent !important;
        }
        
        .gjs-pn-btn:hover {
            background-color: hsl(var(--accent)) !important;
            color: hsl(var(--accent-foreground)) !important;
        }
        
        .gjs-pn-btn.gjs-pn-active {
            background-color: hsl(var(--accent)) !important;
            color: hsl(var(--accent-foreground)) !important;
        }

        /* Inputs */
        .gjs-field {
            background-color: hsl(var(--background)) !important;
            color: hsl(var(--foreground)) !important;
            border: 1px solid hsl(var(--input)) !important;
            border-radius: 0.375rem !important;
        }
        
        .gjs-field:focus-within {
            border-color: hsl(var(--primary)) !important;
            box-shadow: 0 0 0 1px hsl(var(--primary)) !important;
        }
        
        .gjs-field input, 
        .gjs-field select, 
        .gjs-field textarea {
            color: hsl(var(--foreground)) !important;
            background-color: transparent !important;
        }
        
        /* Labels & Text */
        .gjs-sm-label {
             color: hsl(var(--muted-foreground)) !important;
        }
        
        .gjs-sm-header {
             color: hsl(var(--foreground)) !important;
             font-weight: 500 !important;
        }

        /* Icons */
        .gjs-pn-btn svg {
            fill: currentColor !important;
        }
        
        /* Block Manager */
        .gjs-block {
            background-color: hsl(var(--card)) !important;
            border: 1px solid hsl(var(--border)) !important;
            border-radius: 0.5rem !important;
            box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05) !important;
            color: hsl(var(--card-foreground)) !important;
            transition: all 0.2s !important;
        }
        
        .gjs-block:hover {
            border-color: hsl(var(--primary)) !important;
            color: hsl(var(--primary)) !important;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
        }
        
        .gjs-block-label {
            color: inherit !important;
            font-weight: 500 !important;
            font-size: 0.875rem !important;
        }
        
        /* Layer Manager */
        .gjs-layer-title {
            color: hsl(var(--foreground)) !important;
        }
        
        .gjs-layer:hover {
            background-color: hsl(var(--accent)) !important;
        }
        
        .gjs-layer.gjs-selected {
            background-color: hsl(var(--accent)) !important;
            color: hsl(var(--primary)) !important;
            border-left: 2px solid hsl(var(--primary)) !important;
        }

        /* Editor Canvas */
        .gjs-cv-canvas {
            background-color: hsl(var(--muted)) !important;
        }
      `}</style>
    </div>
  );
}
