"use client";

import { useState, useEffect } from "react";
import { API_URL } from "@/lib/api";
import WorkoutDetailModal from "./WorkoutDetailModal";
import BlockHeader from "./BlockHeader";
import WeekNavigator from "./WeekNavigator";
import WeekMetrics from "./WeekMetrics";
import DailySchedule from "./DailySchedule";

interface WeeklyReport {
  weekNumber: number;
  weekType: string;
  workoutsCompleted: number;
  workoutsPrescribed: number;
  complianceRate: number;
  targetTss: number;
  actualTss: number;
  tssComplianceRate: number;
  notes: string;
  weekStartDate: string;
  weekEndDate: string;
}

interface Day {
  date: string;
  dayOfWeek: string;
  workout: any | null;
  activity: any | null;
  completed: boolean;
}

interface BlockWeek {
  weekNumber: number;
  weekType: string;
  startDate: string;
  endDate: string;
  targetTss: number;
  actualTss: number;
  days: Day[];
}

interface BlockData {
  startDate: string;
  endDate: string;
  weeks: BlockWeek[];
  currentWeek: number;
  currentDay: string;
}

export default function ComplianceMetrics({
  athleteId,
}: {
  athleteId: string;
}) {
  const [complianceData, setComplianceData] = useState<any>(null);
  const [fitnessData, setFitnessData] = useState<any>(null);
  const [blockData, setBlockData] = useState<BlockData | null>(null);
  const [currentTsb, setCurrentTsb] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState<Day | null>(
    null,
  );

  useEffect(() => {
    fetchData();
  }, [athleteId]);

  async function fetchData() {
    try {
      const [complianceRes, fitnessRes, activitiesRes, blockRes] =
        await Promise.all([
          fetch(`${API_URL}/analysis/${athleteId}/compliance`),
          fetch(`${API_URL}/analysis/${athleteId}/fitness-trajectory`),
          fetch(`${API_URL}/athlete/${athleteId}/activities?days=30`),
          fetch(`${API_URL}/analysis/${athleteId}/block-overview`),
        ]);

      const [compliance, fitness, activitiesData, blockResponse] =
        await Promise.all([
          complianceRes.json(),
          fitnessRes.json(),
          activitiesRes.json(),
          blockRes.json(),
        ]);

      setComplianceData(compliance);
      setFitnessData(fitness);
      setBlockData(blockResponse.block);
      setSelectedWeek(blockResponse.block.currentWeek);

      // Calculate current TSB from latest activity
      const latestActivity = activitiesData.activities?.[0];
      if (latestActivity?.ctl != null && latestActivity?.atl != null) {
        setCurrentTsb(Math.round(latestActivity.ctl - latestActivity.atl));
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to load compliance data:", err);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-bg-assistant rounded-2xl" />
        <div className="h-64 bg-bg-assistant rounded-2xl" />
      </div>
    );
  }

  if (
    !complianceData ||
    !fitnessData ||
    !blockData ||
    !fitnessData.checkpoints ||
    !complianceData.weeklyReports
  ) {
    return (
      <div className="text-center p-8 bg-bg-card border border-border rounded-2xl">
        <p className="text-muted">No compliance data available</p>
      </div>
    );
  }

  // Get current week data
  const currentWeekData = blockData.weeks.find(
    (w) => w.weekNumber === selectedWeek,
  );
  const complianceWeekData = complianceData.weeklyReports.find(
    (w: WeeklyReport) => w.weekNumber === selectedWeek,
  );

  return (
    <>
      {/* Workout Detail Modal */}
      {selectedWorkoutDay && (
        <WorkoutDetailModal
          day={selectedWorkoutDay}
          athleteId={athleteId}
          onClose={() => setSelectedWorkoutDay(null)}
        />
      )}

      <div className="space-y-6">
        {/* Unified Training Block & Schedule Card */}
        <div className="bg-bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          {/* Header: Block Title + Overall Stats */}
          <BlockHeader
            startDate={blockData.startDate}
            endDate={blockData.endDate}
            overallCompliance={complianceData.overallCompliance}
          />

          {/* Navigation: Interactive Week Progress Bar */}
          <WeekNavigator
            weeklyReports={complianceData.weeklyReports}
            blockData={blockData}
            selectedWeek={selectedWeek}
            onSelectWeek={setSelectedWeek}
          />

          {/* Split Content Body: Daily Schedule (Left) + Weekly Metrics (Right) */}
          {currentWeekData && complianceWeekData && (
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-6">
                {/* Week Metrics */}
                <WeekMetrics
                  weekData={complianceWeekData}
                  selectedWeek={selectedWeek}
                  currentTsb={currentTsb}
                />

                {/* Daily Schedule */}
                <DailySchedule
                  days={currentWeekData.days}
                  selectedWeek={selectedWeek}
                  blockData={blockData}
                  onSelectDay={setSelectedWorkoutDay}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
