import sys
import time
import math
import threading
import numpy as np
import cv2
import pygame

# Initialize Pygame
pygame.init()
WIDTH, HEIGHT = 1000, 750
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("3D Particle Universe")
clock = pygame.time.Clock()

# Particle Count
NUM_PARTICLES = 3500

# Shared state between Camera thread and Pygame thread
shared_data = {
    "running": True,
    "gesture": "saturn",       # 'saturn', 'text', 'heart', 'galaxy'
    "hand_pos": np.array([0.0, 0.0]), # normalized [-1, 1]
    "hand_scale": 1.0,
    "fps": 30
}

# ----------------- SHAPE GENERATORS -----------------

def get_galaxy_particles(count):
    pts = np.zeros((count, 3), dtype=np.float32)
    cols = np.zeros((count, 3), dtype=np.uint8)
    arms = 4
    for i in range(count):
        if np.random.rand() < 0.25:
            # Core
            r = (np.random.rand() ** 2) * 60
            theta = np.random.rand() * 2 * np.pi
            pts[i] = [r * np.cos(theta), r * np.sin(theta) * 0.5, (np.random.rand() - 0.5) * 30]
            cols[i] = [255, 230, 200]
        else:
            arm = i % arms
            r = 60 + (np.random.rand() ** 1.5) * 260
            theta = (arm * 2 * np.pi / arms) + (r * 0.02)
            spread = (np.random.rand() - 0.5) * (15 + r * 0.1)
            pts[i] = [r * np.cos(theta) + spread, (np.random.rand() - 0.5) * 25, r * np.sin(theta) + spread]
            cols[i] = [int(100 + 155 * (r / 320)), int(140 + 100 * (1 - r / 320)), 255]
    return pts, cols

def get_saturn_particles(count):
    pts = np.zeros((count, 3), dtype=np.float32)
    cols = np.zeros((count, 3), dtype=np.uint8)
    n_sphere = int(count * 0.4)
    n_ring = count - n_sphere

    # 1. Sphere
    r_sphere = 85.0
    for i in range(n_sphere):
        u = np.random.rand()
        costheta = 2 * np.random.rand() - 1
        phi = 2 * np.pi * np.random.rand()
        r = r_sphere * (u ** (1/3))
        sintheta = np.sqrt(max(0.0, 1.0 - costheta * costheta))
        pts[i] = [r * sintheta * np.cos(phi), r * costheta * 0.9, r * sintheta * np.sin(phi)]
        cols[i] = [255, int(180 + costheta * 30), 50]

    # 2. Ring (tilted 27 degrees)
    tilt = 0.47
    cos_t = np.cos(tilt)
    sin_t = np.sin(tilt)
    r_min, r_max = 115.0, 260.0

    for i in range(n_sphere, count):
        r = r_min + np.random.rand() * (r_max - r_min)
        # Cassini division gap
        if 170.0 < r < 185.0:
            r = r + 15.0
        theta = np.random.rand() * 2 * np.pi
        raw_x = r * np.cos(theta)
        raw_y = (np.random.rand() - 0.5) * 6.0
        raw_z = r * np.sin(theta)

        pts[i] = [raw_x, raw_y * cos_t - raw_z * sin_t, raw_y * sin_t + raw_z * cos_t]
        cols[i] = [255, int(210 + (r / r_max) * 45), int(120 + (r / r_max) * 80)]

    return pts, cols

def get_heart_particles(count):
    pts = np.zeros((count, 3), dtype=np.float32)
    cols = np.zeros((count, 3), dtype=np.uint8)

    for i in range(count):
        t = np.random.rand() * 2 * np.pi
        u = np.random.rand() ** (1/3)
        x = 16 * (np.sin(t) ** 3)
        y = 13 * np.cos(t) - 5 * np.cos(2*t) - 2 * np.cos(3*t) - np.cos(4*t)
        max_z = np.sqrt(max(0.01, 1.0 - abs(x / 16.0))) * 5.0
        z = (np.random.rand() * 2 - 1) * max_z

        scale = 13.0 * u
        pts[i] = [x * scale, (y * scale) + 20, z * scale]
        cols[i] = [255, int(20 + u * 60), int(60 + u * 80)]

    return pts, cols

# Pre-render text 'I LOVE YOU'
def get_text_particles(count, text="I LOVE YOU"):
    canvas = np.zeros((200, 700), dtype=np.uint8)
    cv2.putText(canvas, text, (30, 130), cv2.FONT_HERSHEY_SIMPLEX, 3.2, 255, 8, cv2.LINE_AA)
    y_indices, x_indices = np.where(canvas > 100)

    x_indices = (x_indices - 350) * 0.95
    y_indices = -(y_indices - 100) * 0.95

    pts = np.zeros((count, 3), dtype=np.float32)
    cols = np.zeros((count, 3), dtype=np.uint8)

    n_pixels = len(x_indices)
    if n_pixels > 0:
        for i in range(count):
            idx = i % n_pixels
            pts[i] = [
                x_indices[idx] + np.random.normal(0, 1.2),
                y_indices[idx] + np.random.normal(0, 1.2),
                (np.random.rand() - 0.5) * 20.0
            ]
            cols[i] = [0, 240, 255] # Cyan glow

    return pts, cols

# Pre-compute shapes
SHAPES = {
    "saturn": get_saturn_particles(NUM_PARTICLES),
    "heart": get_heart_particles(NUM_PARTICLES),
    "galaxy": get_galaxy_particles(NUM_PARTICLES),
    "text": get_text_particles(NUM_PARTICLES, "I LOVE YOU")
}

# ----------------- CAMERA & MEDIAPIPE THREAD -----------------

def camera_thread_fn():
    import mediapipe as mp

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    mp_hands = mp.solutions.hands
    mp_draw = mp.solutions.drawing_utils
    hands = mp_hands.Hands(
        max_num_hands=1,
        min_detection_confidence=0.6,
        min_tracking_confidence=0.6
    )

    prev_time = time.time()

    while shared_data["running"]:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.01)
            continue

        frame = cv2.flip(frame, 1) # Mirror
        h, w, _ = frame.shape
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb)

        detected_gesture = "saturn"

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                # Draw skeleton
                mp_draw.draw_landmarks(
                    frame,
                    hand_landmarks,
                    mp_hands.HAND_CONNECTIONS,
                    mp_draw.DrawingSpec(color=(255, 60, 60), thickness=2, circle_radius=3),
                    mp_draw.DrawingSpec(color=(255, 255, 255), thickness=2)
                )

                lm = hand_landmarks.landmark
                wrist = lm[0]

                # Check fingers
                def dist(p1, p2):
                    return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)

                index_open = dist(lm[8], wrist) > dist(lm[6], wrist) * 1.15
                middle_open = dist(lm[12], wrist) > dist(lm[10], wrist) * 1.15
                ring_open = dist(lm[16], wrist) > dist(lm[14], wrist) * 1.15
                pinky_open = dist(lm[20], wrist) > dist(lm[18], wrist) * 1.15
                thumb_open = dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.18

                fingers = [thumb_open, index_open, middle_open, ring_open, pinky_open]
                count = sum(fingers)

                # Classify
                if count == 0 or (not index_open and not middle_open and not ring_open and not pinky_open):
                    detected_gesture = "heart"
                elif index_open and not middle_open and not ring_open and not pinky_open:
                    detected_gesture = "saturn"
                elif index_open and middle_open and not ring_open and not pinky_open:
                    detected_gesture = "text"
                elif count >= 5:
                    detected_gesture = "galaxy"

                # Hand center
                shared_data["hand_pos"] = np.array([
                    (lm[9].x - 0.5) * 2.0,
                    (lm[9].y - 0.5) * 2.0
                ])

        shared_data["gesture"] = detected_gesture

        # FPS calculation
        curr_time = time.time()
        fps = int(1.0 / max(0.001, curr_time - prev_time))
        prev_time = curr_time
        shared_data["fps"] = fps

        # Draw green telemetry info (Like in photo!)
        cv2.putText(
            frame,
            f"FPS: {fps} | GESTURE: {detected_gesture.upper()}",
            (15, 35),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (0, 255, 100),
            2,
            cv2.LINE_AA
        )

        cv2.imshow("Hand Sensor Monitor", frame)
        if cv2.waitKey(1) & 0xFF == 27: # ESC
            shared_data["running"] = False
            break

    cap.release()
    cv2.destroyAllWindows()

# Start camera thread
cam_thread = threading.Thread(target=camera_thread_fn, daemon=True)
cam_thread.start()

# ----------------- PYGAME MAIN 3D PARTICLE LOOP -----------------

current_positions = SHAPES["saturn"][0].copy()
current_colors = SHAPES["saturn"][1].copy()
target_positions = current_positions.copy()
target_colors = current_colors.copy()
velocities = np.zeros_like(current_positions)

rot_y = 0.0
rot_x = 0.0

active_shape_name = "saturn"

while shared_data["running"]:
    clock.tick(60)

    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            shared_data["running"] = False
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_1:
                shared_data["gesture"] = "saturn"
            elif event.key == pygame.K_2:
                shared_data["gesture"] = "text"
            elif event.key == pygame.K_0:
                shared_data["gesture"] = "heart"
            elif event.key == pygame.K_5:
                shared_data["gesture"] = "galaxy"
            elif event.key == pygame.K_ESCAPE:
                shared_data["running"] = False

    # Check gesture update
    req_gesture = shared_data["gesture"]
    if req_gesture in SHAPES and req_gesture != active_shape_name:
        active_shape_name = req_gesture
        target_positions = SHAPES[active_shape_name][0].copy()
        target_colors = SHAPES[active_shape_name][1].copy()

    # Update 3D particles physics (Spring lerp)
    velocities = (velocities + (target_positions - current_positions) * 0.07) * 0.86
    current_positions += velocities

    # Color lerp
    current_colors = current_colors.astype(np.float32) + (target_colors.astype(np.float32) - current_colors.astype(np.float32)) * 0.08
    current_colors = np.clip(current_colors, 0, 255).astype(np.uint8)

    # Hand interaction rotation
    target_rot_x = shared_data["hand_pos"][1] * 0.6
    target_rot_y = shared_data["hand_pos"][0] * 0.8
    rot_x += (target_rot_x - rot_x) * 0.1
    rot_y += (target_rot_y - rot_y) * 0.1 + 0.005 # auto spin

    # 3D Rotation matrices
    cos_y, sin_y = np.cos(rot_y), np.sin(rot_y)
    cos_x, sin_x = np.cos(rot_x), np.sin(rot_x)

    # Clear screen with pure black
    screen.fill((0, 0, 0))

    # Project and render 3D particles
    cx, cy = WIDTH // 2, HEIGHT // 2
    fov = 420.0
    cam_dist = 480.0

    # Heartbeat pulse
    h_scale = 1.0
    if active_shape_name == "heart":
        h_scale = 1.0 + 0.12 * (math.sin(time.time() * 7.0) ** 4)

    for i in range(NUM_PARTICLES):
        x, y, z = current_positions[i]
        x *= h_scale
        y *= h_scale
        z *= h_scale

        # Rotate around Y then X
        rx = x * cos_y + z * sin_y
        rz = -x * sin_y + z * cos_y
        ry = y * cos_x - rz * sin_x
        rz_final = y * sin_x + rz * cos_x

        # Perspective projection
        depth = rz_final + cam_dist
        if depth > 10.0:
            scale = fov / depth
            sx = int(cx + rx * scale)
            sy = int(cy - ry * scale)

            if 0 <= sx < WIDTH and 0 <= sy < HEIGHT:
                r, g, b = current_colors[i]
                radius = max(1, int(scale * 1.8))
                pygame.draw.circle(screen, (r, g, b), (sx, sy), radius)

    # Render floating minimal tag
    font = pygame.font.SysFont("Consolas", 18, bold=True)
    tag = font.render(f"[ {active_shape_name.upper()} ]", True, (0, 240, 255))
    screen.blit(tag, (WIDTH - 150, 20))

    pygame.display.flip()

pygame.quit()
sys.exit(0)
