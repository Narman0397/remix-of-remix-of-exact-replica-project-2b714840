-- Rollback for Batch C
CREATE POLICY "lap_ins" ON public.laporan_masyarakat FOR INSERT WITH CHECK (true);
