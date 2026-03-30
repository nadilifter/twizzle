"use client";

import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useBreadcrumbOverrides } from "@/components/breadcrumb-context";

const sectionOnlyPaths = new Set([
  "/dashboard/communication",
  "/dashboard/usage",
  "/dashboard/organization",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUID_RE = /^c[a-z0-9]{24,}$/;
const NUMERIC_ID_RE = /^\d+$/;

function looksLikeId(segment: string) {
  return UUID_RE.test(segment) || CUID_RE.test(segment) || NUMERIC_ID_RE.test(segment);
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const { overrides } = useBreadcrumbOverrides();

  const segments = pathname.split("/").filter((segment) => segment !== "");

  if (segments.length === 0) {
    return null;
  }

  const breadcrumbItems = segments.reduce<
    { href: string; title: string; isIdPlaceholder: boolean }[]
  >((acc, segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;

    if (overrides[href]) {
      acc.push({ href, title: overrides[href], isIdPlaceholder: false });
    } else if (looksLikeId(segment)) {
      acc.push({ href, title: "\u2026", isIdPlaceholder: true });
    } else {
      acc.push({
        href,
        title: segment
          .split("-")
          .map((word) => capitalize(word))
          .join(" "),
        isIdPlaceholder: false,
      });
    }

    return acc;
  }, []);

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Always start with Uplifter or Dashboard? 
            If the first segment is 'dashboard', we can treat it as the root or show Home before it.
            Let's assume 'Uplifter' is the home/root context, but if we are in /dashboard, 
            usually Dashboard is the first visible crumb or after Home.
            Let's mimic the previous hardcoded one: Uplifter > Dashboard > ...
        */}

        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href="/">Uplifter</BreadcrumbLink>
        </BreadcrumbItem>

        {breadcrumbItems.length > 0 && <BreadcrumbSeparator className="hidden md:block" />}

        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          return (
            <Fragment key={item.href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.title}</BreadcrumbPage>
                ) : item.isIdPlaceholder || sectionOnlyPaths.has(item.href) ? (
                  <span className="font-normal text-muted-foreground">{item.title}</span>
                ) : (
                  <BreadcrumbLink href={item.href}>{item.title}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
