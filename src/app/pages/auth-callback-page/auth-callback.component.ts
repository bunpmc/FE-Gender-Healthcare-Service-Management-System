import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `<p class="text-center mt-10">Đang đăng nhập...</p>`,
})
export class AuthCallbackComponent implements OnInit {
  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');

    if (accessToken) {
      // Lưu token vào localStorage
      localStorage.setItem('access_token', accessToken);

      // Gọi API /me để lấy thông tin user
      this.http
        .get(`${environment.apiEndpoint}/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        .subscribe({
          next: (res: any) => {
            console.log('Thông tin user:', res);
            localStorage.setItem('current_user', JSON.stringify(res));
            this.router.navigate(['/']);
          },
          error: (err) => {
            console.error('Lỗi gọi /me:', err);
            alert('Đăng nhập thất bại, vui lòng thử lại!');
            this.router.navigate(['/']);
          },
        });
    } else {
      console.error('Không tìm thấy access_token trên URL');
      this.router.navigate(['/']);
    }
  }
}
