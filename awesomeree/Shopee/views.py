from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.renderers import JSONRenderer
from datetime import datetime, timedelta
import gspread
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
import pytz
import logging
from typing import List, Dict, Any, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def smart_retry_decorator(
    max_attempts: int = 3,
    min_wait: float = 2.0,
    max_wait: float = 10.0
):
    return retry(
        retry=retry_if_exception_type(gspread.exceptions.APIError),
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=min_wait, max=max_wait),
        before_sleep=lambda retry_state: logger.warning(
            f"Rate limit hit. Attempt {retry_state.attempt_number}. "
            f"Waiting {retry_state.next_action.sleep} seconds..."
        )
    )

class ShopeeHealthDataAPI(APIView):
    renderer_classes = [JSONRenderer]
    METRICS_PER_DAY = 9  # shop name + 8 metrics
    
    def __init__(self):
        super().__init__()
        self._worksheet = None
        
    @property
    @smart_retry_decorator()
    def worksheet(self):
        if self._worksheet is None:
            SERVICE_ACCOUNT_FILE = r'C:\Users\Mohd Low\awesomeree-webUI\awesomeree\Shopee\cred.json'
            SHEET_URL = 'https://docs.google.com/spreadsheets/d/11rOrVdtwWCYSTOfRgZT3XlDoOVLJ7GV8507jGTAx2dk/edit?usp=sharing'
            
            creds = gspread.service_account(filename=SERVICE_ACCOUNT_FILE)
            spreadsheet = creds.open_by_url(SHEET_URL)
            self._worksheet = spreadsheet.worksheet("Active Bot Tab")
        return self._worksheet

    @staticmethod
    def safe_float_convert(value: Any) -> float:
        """Convert value to float, handling empty and special cases"""
        if not value or value == '-' or value == '' or value == 'N/A':
            return 0.0
        try:
            # Remove % sign and any whitespace
            str_value = str(value).replace('%', '').strip()
            return float(str_value)
        except (ValueError, TypeError, AttributeError):
            return 0.0

    @staticmethod
    def parse_date(date_str: str) -> Optional[datetime.date]:
        """Parse date string from the sheet format"""
        if not date_str or date_str.lower() == 'date':
            return None
        try:
            return datetime.strptime(date_str.strip(), "%d/%m/%Y").date()
        except (ValueError, AttributeError):
            return None

    @smart_retry_decorator()
    def get_sheet_data(self) -> List[List[str]]:
        """Fetch raw sheet data"""
        # Get all values including the date row
        return self.worksheet.get_all_values()

    def process_shop_data(self, row: List[str], dates_row: List[str], metrics_indices: Dict) -> List[Dict]:
        """Process a single shop's data for all days"""
        shop_data = []
        
        # Skip empty rows or header rows
        if not row or not row[0] or row[0] == 'Shop Name' or row[0] == 'Date':
            return []

        # Process each day's data
        for day_idx in range(6):  # 6 days of data
            start_idx = day_idx * self.METRICS_PER_DAY
            
            # Skip if no shop name
            shop_name = row[start_idx].strip()
            if not shop_name:
                continue

            # Get date for this column set
            date_str = dates_row[start_idx]
            data_date = self.parse_date(date_str)
            if not data_date:
                continue

            try:
                metric_data = {
                    'date': data_date.isoformat(),
                    'shop_name': shop_name,
                    'non_fulfillment_rate': self.safe_float_convert(row[start_idx + 1]),
                    'late_shipment_rate': self.safe_float_convert(row[start_idx + 2]),
                    'preparation_time': self.safe_float_convert(row[start_idx + 3]),
                    'fast_handover_rate': self.safe_float_convert(row[start_idx + 4]),
                    'response_rate': self.safe_float_convert(row[start_idx + 5]),
                    'average_response_time': row[start_idx + 6] if row[start_idx + 6] not in ['-', '', 'N/A'] else 'N/A',
                    'shop_rating': self.safe_float_convert(row[start_idx + 7]),
                    'penalty_points': int(self.safe_float_convert(row[start_idx + 8]))
                }
                shop_data.append(metric_data)
            except Exception as e:
                logger.error(f"Error processing shop {shop_name} for date {date_str}: {str(e)}")
                continue

        return shop_data

    def get(self, request):
        try:
            # Get all sheet data
            sheet_data = self.get_sheet_data()
            
            if not sheet_data:
                return Response({'error': 'No data found in sheet'}, status=status.HTTP_404_NOT_FOUND)

            # Find the dates row (last row)
            dates_row = None
            for row in reversed(sheet_data):
                if row and row[0].lower().strip() == 'date':
                    dates_row = row
                    break

            if not dates_row:
                return Response({'error': 'Date row not found'}, status=status.HTTP_404_NOT_FOUND)

            # Process all shops
            all_data = []
            for row in sheet_data:
                if row and row[0] and row[0].lower().strip() != 'date':
                    try:
                        shop_data = self.process_shop_data(row, dates_row, {})
                        all_data.extend(shop_data)
                    except Exception as e:
                        logger.error(f"Error processing row: {str(e)}")
                        continue

            # Sort by date and shop name
            all_data.sort(key=lambda x: (x['date'], x['shop_name']))

            if not all_data:
                return Response({'error': 'No valid data processed'}, status=status.HTTP_404_NOT_FOUND)

            return Response(all_data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to fetch data: {str(e)}")
            return Response(
                {'error': f'Failed to fetch data: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ShopeeHLateShipmentDataAPI(APIView):
    renderer_classes = [JSONRenderer]
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._worksheet = None
        
    @property
    @smart_retry_decorator()
    def worksheet(self):
        if self._worksheet is None:
            SERVICE_ACCOUNT_FILE = r'C:\Users\Mohd Low\Music\Service Files\firsttest-432604-6038cb0c81d1.json'
            SHEET_URL = 'https://docs.google.com/spreadsheets/d/1cE3lOuM44zZvJBPVJJ6iNyNDKWJmsSXC3CQDj1Qcu34/'
            creds = gspread.service_account(filename=SERVICE_ACCOUNT_FILE)
            spreadsheet = creds.open_by_url(SHEET_URL)
            # Replace "Sheet1" with the actual sheet name where your data resides.
            self._worksheet = spreadsheet.worksheet("Sheet1")
        return self._worksheet

    def get_sheet_data(self):
        """Fetch all rows from the sheet"""
        return self.worksheet.get_all_values()

    def process_row(self, row):
        """
        Process a single row from the Google Sheet.
        Assumes the following indices (0-indexed):
          0: Order id
          1: Date
          2: Shop Name
          3: SKUs
          5: Courier
          7: Status
          8: Warning Message
          9: Remark
        Columns E (index 4) and G (index 6) are empty and skipped.
        """
        # Skip header rows (for example if the first cell is "Order id")
        if not row or row[0].lower() == "order id":
            return None

        try:
            order_id = row[0].strip()
            date_str = row[1].strip()
            shop_name = row[2].strip()
            skus = row[3].strip()
            courier = row[5].strip() if len(row) > 5 else ""
            status_val = row[7].strip() if len(row) > 7 else ""
            warning_message = row[8].strip() if len(row) > 8 else ""
            remark = row[9].strip() if len(row) > 9 else ""

            # Optionally, convert the date into ISO format if possible.
            try:
                date_obj = datetime.strptime(date_str, "%d/%m/%Y")
                date_iso = date_obj.date().isoformat()
            except Exception as e:
                logger.error(f"Date conversion error for value {date_str}: {e}")
                date_iso = date_str  # Fallback to original string

            return {
                "order_id": order_id,
                "date": date_iso,
                "shop_name": shop_name,
                "skus": skus,
                "courier": courier,
                "status": status_val,
                "warning_message": warning_message,
                "remark": remark
            }
        except Exception as e:
            logger.error(f"Error processing row: {e}")
            return None

    def get(self, request, format=None):
        try:
            sheet_data = self.get_sheet_data()
            if not sheet_data:
                return Response({"error": "No data found in sheet"}, status=status.HTTP_404_NOT_FOUND)
            
            json_data = []
            for row in sheet_data:
                processed = self.process_row(row)
                if processed:
                    json_data.append(processed)
            
            if not json_data:
                return Response({"error": "No valid data processed"}, status=status.HTTP_404_NOT_FOUND)
            
            # Optionally, sort your data if needed. For example, by date:
            json_data.sort(key=lambda x: x.get('date', ''))
            
            return Response(json_data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Failed to fetch data: {e}")
            return Response({"error": f"Failed to fetch data: {e}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)