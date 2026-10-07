"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { Select } from "@/components/ui/select";
import { isValidTimeZone } from "@/lib/dates/time-zone";

type TimeZoneSelectProps = {
  appearance?: "default" | "setup";
  id: string;
  initialTimeZone?: string | null;
  name?: string;
  timeZones: string[];
};

function formatTimeZoneLabel(timeZone: string) {
  return timeZone.replaceAll("_", " ");
}

function subscribeToDeviceTimeZone() {
  return () => undefined;
}

function getDeviceTimeZoneSnapshot() {
  const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return detectedTimeZone && isValidTimeZone(detectedTimeZone)
    ? detectedTimeZone
    : null;
}

function getServerTimeZoneSnapshot() {
  return null;
}

export function TimeZoneSelect({
  appearance = "default",
  id,
  initialTimeZone,
  name = "timeZone",
  timeZones,
}: TimeZoneSelectProps) {
  const [selectedTimeZoneOverride, setSelectedTimeZoneOverride] = useState<
    string | null
  >(null);
  const deviceTimeZone = useSyncExternalStore(
    subscribeToDeviceTimeZone,
    getDeviceTimeZoneSnapshot,
    getServerTimeZoneSnapshot,
  );
  const selectedTimeZone =
    selectedTimeZoneOverride ?? initialTimeZone ?? deviceTimeZone ?? "";
  const options = useMemo(() => {
    const allTimeZones = new Set(timeZones);

    if (selectedTimeZone) {
      allTimeZones.add(selectedTimeZone);
    }

    if (deviceTimeZone) {
      allTimeZones.add(deviceTimeZone);
    }

    return [...allTimeZones].sort((left, right) => left.localeCompare(right));
  }, [deviceTimeZone, selectedTimeZone, timeZones]);
  const description = deviceTimeZone
    ? `This device reports ${formatTimeZoneLabel(deviceTimeZone)}. Confirm the time zone that should define your financial day.`
    : "Confirm the time zone that should define your financial day.";

  return (
    <div className={appearance === "setup" ? "setup-time-zone" : "space-y-2"}>
      <Select
        id={id}
        name={name}
        className={appearance === "setup" ? "setup-select" : undefined}
        aria-describedby={`${id}-description`}
        value={selectedTimeZone}
        onChange={(event) => setSelectedTimeZoneOverride(event.target.value)}
        required
      >
        <option value="" disabled>
          Choose time zone
        </option>
        {options.map((timeZone) => (
          <option key={timeZone} value={timeZone}>
            {formatTimeZoneLabel(timeZone)}
          </option>
        ))}
      </Select>
      <p id={`${id}-description`} className={appearance === "setup" ? "setup-helper" : "text-sm leading-6 text-muted-foreground"}>
        {appearance === "setup" ? description.replace(/\.+$/, "") : description}
      </p>
    </div>
  );
}
