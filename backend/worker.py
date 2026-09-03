import time
import os
import subprocess
from sqlalchemy.orm import Session
from db.session import SessionLocal
from models.models import Match, HeatmapStatus, VideoChunk
from services.ai.tracker import process_video_for_heatmap

def run_worker():
    while True:
        db: Session = SessionLocal()
        try:
            # Check for a queued job
            queued_match = db.query(Match).filter(Match.heatmap_status == HeatmapStatus.QUEUED).first()

            if queued_match:
                print(f"Found queued match: {queued_match.id}")

                # Check if another job is already processing
                processing_match = db.query(Match).filter(Match.heatmap_status == HeatmapStatus.PROCESSING).first()
                if processing_match:
                    print(f"Another match is already processing: {processing_match.id}. Waiting...")
                    # No need to sleep here, the main loop will sleep
                else:
                    # Set status to processing
                    queued_match.heatmap_status = HeatmapStatus.PROCESSING
                    db.commit()

                    # Get the video path
                    video_chunk = db.query(VideoChunk).filter(VideoChunk.match_id == queued_match.id).first()
                    if not video_chunk or not os.path.exists(video_chunk.video_path):
                        print(f"Video for match {queued_match.id} not found.")
                        queued_match.heatmap_status = HeatmapStatus.ERROR
                        db.commit()
                    else:
                        # Define paths
                        match_upload_dir = os.path.dirname(video_chunk.video_path)
                        heatmap_output_path = os.path.join(match_upload_dir)

                        # Create the directory if it doesn't exist
                        os.makedirs(heatmap_output_path, exist_ok=True)

                        print(f"Processing video: {video_chunk.video_path}")

                        # Run the processing script with low priority
                        try:
                            import sys
                            # Using nice under Linux/Unix to lower CPU priority
                            if os.name == 'nt':
                                command = [
                                    sys.executable,
                                    "-c",
                                    f"from services.ai.tracker import process_video_for_heatmap; process_video_for_heatmap({repr(video_chunk.video_path)}, {repr(heatmap_output_path)})"
                                ]
                            else:
                                command = [
                                    "nice",
                                    "-n",
                                    "10",
                                    sys.executable,
                                    "-c",
                                    f"from services.ai.tracker import process_video_for_heatmap; process_video_for_heatmap({repr(video_chunk.video_path)}, {repr(heatmap_output_path)})"
                                ]
                            subprocess.run(command, check=True)

                            # Re-establish session for update after long process
                            db_update_session = SessionLocal()
                            match_to_update = db_update_session.query(Match).filter(Match.id == queued_match.id).first()

                            # Update match status
                            heatmap_file_path = os.path.join(heatmap_output_path, "heatmap.png")
                            if os.path.exists(heatmap_file_path):
                                match_to_update.heatmap_status = HeatmapStatus.DONE
                                match_to_update.heatmap_path = heatmap_file_path
                            else:
                                match_to_update.heatmap_status = HeatmapStatus.ERROR

                            db_update_session.commit()
                            db_update_session.close()
                            print(f"Finished processing match: {queued_match.id}")

                        except subprocess.CalledProcessError as e:
                            print(f"Error processing video for match {queued_match.id}: {e}")
                            db_update_session = SessionLocal()
                            match_to_update = db_update_session.query(Match).filter(Match.id == queued_match.id).first()
                            match_to_update.heatmap_status = HeatmapStatus.ERROR
                            db_update_session.commit()
                            db_update_session.close()
            else:
                print("No queued jobs found. Waiting...")

        except Exception as e:
            print(f"An error occurred in the worker: {e}")
            if 'db' in locals() and db.is_active:
                db.rollback()
        finally:
            if 'db' in locals():
                db.close()

            # Sleep at the end of every loop
            time.sleep(60)

if __name__ == "__main__":
    run_worker()
