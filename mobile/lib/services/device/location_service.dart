import '../../config/app_config.dart';

/// Kết quả định vị
class LocationResult {
  const LocationResult({required this.granted, this.lat, this.lng, this.address});

  final bool granted;
  final double? lat;
  final double? lng;
  final String? address;
}

/// Adapter định vị GPS — Phase 1 mock; tích hợp ngoài thay bằng geolocator + reverse geocode (P3-26).
/// Luồng từ chối quyền (câu hỏi mở #16) mô phỏng qua [simulateDenied].
class LocationService {
  /// Bật để thử luồng người dùng từ chối quyền GPS
  static bool simulateDenied = false;

  Future<LocationResult> currentLocation() async {
    await Future<void>.delayed(AppConfig.mockDelay);
    if (simulateDenied) return const LocationResult(granted: false);
    return const LocationResult(
      granted: true,
      lat: 20.7431,
      lng: 105.9214,
      address: 'Đường trục Thôn Đông, ${AppConfig.orgName}',
    );
  }
}
