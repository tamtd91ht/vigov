// =============================================================================
// ViGov — Jenkins declarative pipeline (P4-34 / WBS #34–35)
//
// Luồng:
//   Checkout
//     → Build & Test (4 module chạy SONG SONG: backend / admin-web /
//       zalo-miniapp / mobile)
//     → Docker Build & Push  (tag = <branch>-<git short sha> + <branch>-latest)
//     → Deploy Staging       (tự động, chỉ nhánh `develop`)
//     → Manual Approval      (input — người phụ trách bấm duyệt)
//     → Deploy Production    (chỉ nhánh `main`)
//
// NGUYÊN TẮC BẢO MẬT
//   · Không hardcode secret: mọi thông tin đăng nhập lấy qua credentials().
//   · Không hardcode đường dẫn tuyệt đối: dùng WORKSPACE của Jenkins.
//   · File .env của từng môi trường nằm SẴN trên máy chủ đích (chmod 600),
//     pipeline không bao giờ ghi secret vào workspace.
//
// CHUẨN BỊ TRÊN JENKINS (Manage Jenkins → Credentials)
//   vigov-registry-credentials  Username with password  — tài khoản Docker registry
//   vigov-staging-ssh           SSH Username with private key — deploy staging
//   vigov-production-ssh        SSH Username with private key — deploy production
//   vigov-android-keystore      Secret file (tuỳ chọn) — keystore ký APK phát hành
//
// YÊU CẦU AGENT (Linux): docker + docker compose plugin, node >= 22 (npm),
// flutter SDK, jdk 17 (cho Android), ssh client. Nếu agent chưa có Flutter,
// đặt nhãn riêng cho stage Mobile hoặc bật cờ SKIP_MOBILE.
//
// PLUGIN JENKINS CẦN CÀI: Pipeline, Credentials Binding, SSH Agent,
// Timestamper, Workspace Cleanup (cleanWs).
// =============================================================================

pipeline {
    agent any

    options {
        timestamps()
        // Tự Checkout ở stage đầu để kiểm soát và lấy được commit sha.
        skipDefaultCheckout(true)
        // Giữ 30 lần build gần nhất, chỉ giữ artifact của 10 lần — tránh đầy đĩa Jenkins.
        buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
        timeout(time: 90, unit: 'MINUTES')
        // Tránh 2 lần deploy chồng nhau lên cùng một máy chủ.
        disableConcurrentBuilds()
    }

    parameters {
        // Các giá trị KHÔNG PHẢI secret nhưng thay đổi theo khách hàng —
        // để dạng tham số thay vì hardcode trong pipeline.
        string(name: 'REGISTRY_HOST', defaultValue: 'registry.example.vn',
               description: 'Docker registry (không kèm https://)')
        string(name: 'REGISTRY_NAMESPACE', defaultValue: 'vigov',
               description: 'Namespace/project trên registry')
        string(name: 'STAGING_HOST', defaultValue: 'staging.vigov.internal',
               description: 'Máy chủ staging (SSH)')
        string(name: 'PRODUCTION_HOST', defaultValue: 'prod.vigov.internal',
               description: 'Máy chủ production (SSH)')
        string(name: 'REMOTE_DEPLOY_DIR', defaultValue: '/opt/vigov',
               description: 'Thư mục chứa docker-compose.yml + .env trên máy chủ đích')
        booleanParam(name: 'SKIP_MOBILE', defaultValue: false,
                     description: 'Bỏ qua stage Mobile khi agent chưa cài Flutter SDK')
    }

    environment {
        // credentials() nạp bí mật vào biến môi trường, Jenkins tự che (mask) trong log.
        // Với "Username with password" sẽ sinh thêm _USR và _PSW.
        REGISTRY_CRED = credentials('vigov-registry-credentials')

        // Tiền tố tên image, ví dụ: registry.example.vn/vigov/vigov-backend
        IMAGE_PREFIX = "${params.REGISTRY_HOST}/${params.REGISTRY_NAMESPACE}"

        // Không gửi telemetry ra ngoài (mạng nhà nước thường chặn, gây treo build).
        NEXT_TELEMETRY_DISABLED = '1'
        CI = 'true'
    }

    stages {

        // ─────────────────────────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // Tag image: <branch>-<sha7>. Branch có thể chứa "/" (feature/x)
                    // nên phải thay bằng "-" cho hợp lệ với Docker tag.
                    env.GIT_COMMIT_SHORT = sh(script: 'git rev-parse --short=7 HEAD',
                                              returnStdout: true).trim()
                    env.BRANCH_SLUG = (env.BRANCH_NAME ?: 'local')
                                        .replaceAll('[^A-Za-z0-9._-]', '-')
                                        .toLowerCase()
                    env.IMAGE_TAG = "${env.BRANCH_SLUG}-${env.GIT_COMMIT_SHORT}"
                    // Tag phụ để máy chủ đích luôn kéo được bản mới nhất của nhánh.
                    env.IMAGE_TAG_LATEST = "${env.BRANCH_SLUG}-latest"

                    echo "Nhánh: ${env.BRANCH_NAME} · Commit: ${env.GIT_COMMIT_SHORT} · Tag: ${env.IMAGE_TAG}"
                    currentBuild.displayName = "#${env.BUILD_NUMBER} · ${env.IMAGE_TAG}"
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // 4 module độc lập nhau ⇒ chạy song song để rút ngắn thời gian CI.
        // ─────────────────────────────────────────────────────────────────────
        stage('Build & Test') {
            parallel {

                stage('Backend') {
                    steps {
                        dir('backend') {
                            // npm ci: cài đúng theo package-lock, sạch và tái lập được.
                            sh 'npm ci'
                            sh 'npm run build'
                            // Unit test (P5-07): dùng mock cho model Mongoose, không
                            // chạm cơ sở dữ liệu. Chạy trước vì nhanh ⇒ fail sớm.
                            sh 'npm test'
                            // test:e2e dùng mongodb-memory-server ⇒ không cần Mongo thật.
                            sh 'npm run test:e2e'
                        }
                    }
                }

                stage('Admin Web') {
                    steps {
                        dir('admin-web') {
                            sh 'npm ci'
                            sh 'npm run lint'
                            // Test component + hàm định dạng bằng Vitest (P5-07);
                            // vitest run trả mã lỗi khi có test đỏ ⇒ build đỏ.
                            sh 'npm test'
                            // Build kiểm tra ở đây chỉ để bắt lỗi biên dịch sớm;
                            // bundle phát hành được build lại trong Docker với
                            // đúng bộ NEXT_PUBLIC_* của từng môi trường.
                            sh 'npm run build'
                        }
                    }
                }

                stage('Zalo Mini App') {
                    steps {
                        dir('zalo-miniapp') {
                            sh 'npm ci'
                            sh 'npm run lint'
                            sh 'npm run build'
                        }
                    }
                }

                stage('Mobile') {
                    when {
                        expression { return !params.SKIP_MOBILE }
                    }
                    steps {
                        dir('mobile') {
                            sh 'flutter --version'
                            sh 'flutter pub get'
                            // flutter analyze trả mã lỗi khi có warning/error ⇒ build đỏ.
                            sh 'flutter analyze'
                            // Widget test + unit test của app công dân (P5-07);
                            // flutter test trả mã lỗi khi có test đỏ ⇒ build đỏ.
                            sh 'flutter test'
                            sh 'flutter build apk --release'
                        }
                    }
                    post {
                        success {
                            // APK để QA cài thử; bản ký phát hành lên CH Play làm ở P4-37.
                            archiveArtifacts artifacts: 'mobile/build/app/outputs/flutter-apk/*.apk',
                                             fingerprint: true, allowEmptyArchive: true
                        }
                    }
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Chỉ build & push image cho các nhánh sẽ được triển khai.
        // ─────────────────────────────────────────────────────────────────────
        stage('Docker Build & Push') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                script {
                    // Đăng nhập registry qua stdin: mật khẩu không xuất hiện trong
                    // bảng tiến trình (`ps`) và không bị ghi vào log.
                    // Dùng chuỗi nháy đơn để Groovy KHÔNG nội suy $REGISTRY_CRED_*
                    // — shell mới là bên đọc biến, Jenkins vẫn mask giá trị.
                    sh('echo "$REGISTRY_CRED_PSW" | docker login ' + params.REGISTRY_HOST +
                       ' --username "$REGISTRY_CRED_USR" --password-stdin')

                    // Cấu hình công khai nhúng lúc build — khác nhau giữa staging và prod.
                    // Lấy từ biến môi trường toàn cục của Jenkins (Manage Jenkins →
                    // System → Global properties), KHÔNG hardcode trong file này.
                    def isProd   = (env.BRANCH_NAME == 'main')
                    def apiBase  = isProd ? env.VIGOV_PROD_API_BASE_URL : env.VIGOV_STAGING_API_BASE_URL
                    def orgName  = env.VIGOV_ORG_NAME    ?: ''
                    def orgParent= env.VIGOV_ORG_PARENT  ?: ''
                    def orgShort = env.VIGOV_ORG_SHORT   ?: 'VG'
                    def appVer   = "${env.BRANCH_SLUG}-${env.GIT_COMMIT_SHORT}"

                    if (!apiBase) {
                        error('Thiếu biến toàn cục VIGOV_STAGING_API_BASE_URL / VIGOV_PROD_API_BASE_URL trên Jenkins.')
                    }

                    // --- backend: không có biến nhúng lúc build ---
                    buildAndPush('vigov-backend', 'backend', '')

                    // --- admin-web: NEXT_PUBLIC_* nhúng vào bundle lúc build ---
                    buildAndPush('vigov-admin-web', 'admin-web', """
                        --build-arg NEXT_PUBLIC_API_BASE_URL='${apiBase}'
                        --build-arg NEXT_PUBLIC_USE_MOCKS=false
                        --build-arg NEXT_PUBLIC_ORG_NAME='${orgName}'
                        --build-arg NEXT_PUBLIC_ORG_PARENT='${orgParent}'
                        --build-arg NEXT_PUBLIC_ORG_SHORT='${orgShort}'
                        --build-arg NEXT_PUBLIC_APP_VERSION='${appVer}'
                    """.replaceAll('\\s+', ' ').trim())

                    // --- zalo-miniapp: VITE_* nhúng vào bundle lúc build ---
                    buildAndPush('vigov-zalo-miniapp', 'zalo-miniapp', """
                        --build-arg VITE_API_BASE_URL='${apiBase}'
                        --build-arg VITE_USE_MOCKS=false
                        --build-arg VITE_ORG_NAME='${orgName}'
                        --build-arg VITE_ORG_PARENT='${orgParent}'
                        --build-arg VITE_ORG_SHORT='${orgShort}'
                        --build-arg VITE_APP_VERSION='${appVer}'
                    """.replaceAll('\\s+', ' ').trim())
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        stage('Deploy Staging') {
            when { branch 'develop' }
            steps {
                // sshagent nạp khoá riêng vào ssh-agent trong phạm vi block này;
                // khoá không bao giờ được ghi ra workspace.
                sshagent(credentials: ['vigov-staging-ssh']) {
                    script {
                        deployTo(params.STAGING_HOST, params.REMOTE_DEPLOY_DIR, env.IMAGE_TAG)
                    }
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        // Cổng duyệt tay: chặn mọi thay đổi tự động lên hệ thống đang phục vụ dân.
        // ─────────────────────────────────────────────────────────────────────
        stage('Manual Approval') {
            when { branch 'main' }
            options {
                // Không ai duyệt trong 24h ⇒ huỷ build, không treo executor mãi.
                timeout(time: 24, unit: 'HOURS')
            }
            steps {
                script {
                    def approval = input(
                        id: 'deploy-production',
                        message: "Triển khai ViGov ${env.IMAGE_TAG} lên PRODUCTION (${params.PRODUCTION_HOST})?",
                        // Chỉ nhóm được phép mới thấy nút duyệt (cấu hình group trên Jenkins).
                        submitter: 'vigov-release-managers',
                        submitterParameter: 'APPROVED_BY',
                        parameters: [
                            booleanParam(name: 'BACKUP_BEFORE_DEPLOY', defaultValue: true,
                                         description: 'Chạy mongodump trước khi cập nhật')
                        ]
                    )
                    env.APPROVED_BY = approval['APPROVED_BY']
                    env.BACKUP_BEFORE_DEPLOY = approval['BACKUP_BEFORE_DEPLOY'].toString()
                    echo "Được duyệt bởi: ${env.APPROVED_BY}"
                }
            }
        }

        // ─────────────────────────────────────────────────────────────────────
        stage('Deploy Production') {
            when { branch 'main' }
            steps {
                sshagent(credentials: ['vigov-production-ssh']) {
                    script {
                        if (env.BACKUP_BEFORE_DEPLOY == 'true') {
                            // Sao lưu trước khi đổi phiên bản để còn đường lùi.
                            sshRun(params.PRODUCTION_HOST,
                                   "cd ${params.REMOTE_DEPLOY_DIR}\nbash deploy/backup-mongo.sh")
                        }
                        deployTo(params.PRODUCTION_HOST, params.REMOTE_DEPLOY_DIR, env.IMAGE_TAG)
                    }
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    post {
        always {
            // Lưu lại sản phẩm build để đối chiếu/khôi phục khi cần.
            archiveArtifacts artifacts: 'mobile/build/app/outputs/flutter-apk/*.apk',
                             fingerprint: true, allowEmptyArchive: true
            archiveArtifacts artifacts: 'docker-compose.yml, .env.example, deploy/**',
                             allowEmptyArchive: true

            // Đăng xuất registry và dọn image trung gian để agent không đầy đĩa.
            sh 'docker logout "' + params.REGISTRY_HOST + '" || true'
            sh 'docker image prune -f --filter "until=72h" || true'

            // Xoá workspace: node_modules + build của 4 module rất nặng.
            cleanWs(deleteDirs: true, notFailBuild: true)
        }
        success {
            echo "Build ${env.IMAGE_TAG} thành công."
        }
        failure {
            echo "Build ${env.IMAGE_TAG} THẤT BẠI — xem log stage tương ứng."
            // Gắn thêm mailer/Slack tại đây khi khách chốt kênh thông báo.
        }
        aborted {
            echo "Build bị huỷ (thường do hết hạn duyệt tay)."
        }
    }
}

// =============================================================================
// Hàm dùng chung
// =============================================================================

/**
 * Build 1 image từ thư mục module rồi push 2 tag: tag theo commit (bất biến,
 * dùng để deploy/rollback chính xác) và tag <branch>-latest (tiện tra cứu).
 */
def buildAndPush(String imageName, String contextDir, String extraArgs) {
    def image = "${env.IMAGE_PREFIX}/${imageName}"
    sh """
        docker build ${extraArgs} \
            --tag ${image}:${env.IMAGE_TAG} \
            --tag ${image}:${env.IMAGE_TAG_LATEST} \
            --label org.opencontainers.image.revision=${env.GIT_COMMIT} \
            --label org.opencontainers.image.version=${env.IMAGE_TAG} \
            ${contextDir}
        docker push ${image}:${env.IMAGE_TAG}
        docker push ${image}:${env.IMAGE_TAG_LATEST}
    """
}

/**
 * Chạy một đoạn script trên máy chủ đích qua SSH (khoá đã nạp bởi sshagent).
 * Script được đẩy qua stdin bằng heredoc có trích dẫn (<<'REMOTE') nên shell
 * cục bộ KHÔNG diễn giải $ hay dấu nháy — tránh mọi lỗi escape lồng nhau.
 * StrictHostKeyChecking=accept-new: chấp nhận host key lần đầu nhưng vẫn báo
 * lỗi nếu key đổi (chống man-in-the-middle) — an toàn hơn "no".
 */
def sshRun(String host, String script) {
    sh("ssh -o StrictHostKeyChecking=accept-new " + host +
       " bash -s <<'REMOTE'\n" + script + "\nREMOTE\n")
}

/**
 * Triển khai: ghi IMAGE_TAG mới vào .env trên máy chủ rồi `compose up -d`.
 * Compose chỉ tạo lại container nào có image đổi ⇒ cập nhật cuốn chiếu,
 * Mongo/RabbitMQ không bị khởi động lại.
 * `--wait` chờ tới khi mọi service báo healthy, quá hạn thì trả mã lỗi ⇒ build đỏ.
 */
def deployTo(String host, String remoteDir, String tag) {
    // Không chứa secret: mọi secret nằm trong file .env sẵn có trên máy chủ (chmod 600).
    def remoteScript = """
set -euo pipefail
cd ${remoteDir}
# Lưu .env cũ để rollback nhanh: khôi phục file rồi `docker compose up -d`
cp .env .env.bak.\$(date +%Y%m%d%H%M%S)
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=${tag}|' .env
docker compose pull
docker compose up -d --remove-orphans --wait --wait-timeout 180
docker compose ps
docker image prune -f
"""
    sshRun(host, remoteScript.trim())
    echo "Đã triển khai ${tag} lên ${host}."
}
