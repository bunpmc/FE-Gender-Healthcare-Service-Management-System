import { Component } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-google',
  standalone: true,
  templateUrl: './google.component.html',
  styleUrls: ['./google.component.css'], // <-- fix ở đây
})
export class GoogleComponent {
  supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  isLoading = false;

  async signInWithGoogle() {
    try {
      this.isLoading = true;

      // Get the current origin dynamically
      const currentOrigin = environment.getCurrentOrigin();
      const redirectUrl = `${currentOrigin}${environment.authCallbackUrl}`;

      console.log('Using redirect URL:', redirectUrl);

      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        console.error('Google sign-in error:', error.message);
        alert('Google sign-in failed. Please try again.');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('Unexpected error occurred.');
    } finally {
      this.isLoading = false;
    }
  }
}
