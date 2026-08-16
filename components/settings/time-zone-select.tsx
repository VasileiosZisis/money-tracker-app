"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import { Select } from "@/components/ui/select";
import { isValidTimeZone } from "@/lib/dates/time-zone";

type TimeZoneSelectProps = {
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

  return (
    <div className="space-y-2">
      <Select
        id={id}
        name={name}
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
      <p className="text-sm leading-6 text-muted-foreground">
        {deviceTimeZone
          ? `This device reports ${formatTimeZoneLabel(deviceTimeZone)}. Confirm the time zone that should define your financial day.`
          : "Confirm the time zone that should define your financial day."}
      </p>
    </div>
  );
}
